// Lógica de cada socket listener de NotificationContext, extraída como
// funciones puras. Antes vivía inline en el provider, 30-50 líneas por
// listener × 23 listeners = ~800 líneas de ifs/maps/filters inscrustados
// que eran difíciles de seguir y aun más difíciles de testear sin montar
// el provider entero con socket mocks.
//
// Cada reducer toma `setNotifications` / `setToasts` como callbacks (no
// state directo) — así son agnósticos al provider y testeables con
// `vi.fn()` spies. El context solo:
//   1) Chequea si el resource está "activo" (notif suprimida).
//   2) Llama al reducer correspondiente.
//
// REGLAS CRÍTICAS QUE NO SE PUEDEN ROMPER (memory: notifications-contract):
//   - `count` se SETEA con el valor del payload del server, NUNCA se
//     incrementa localmente (`n.count + 1` re-introduce el bug de
//     doble-conteo, ver feedback_optimistic_vs_socket).
//   - Dedup por `notifId` (o por resource key como fallback).
//   - `markRead*` resetea `count: 0` para que el próximo evento arranque
//     limpio.

import axios from "axios";
import { API } from "../api/endpoints";

// ── Keys y dedup ─────────────────────────────────────────────────────

export const notifKey = (n) => {
  // Cuando viene del server con _id (post-refactor), lo usamos como key
  // exacta — dedup determinístico y no susceptible a races de timestamp.
  const id = n.notifId || n._id;
  if (id) return `id:${id}`;
  // Fallback para notifs creadas localmente antes de recibir el doc del server.
  const type = n.type ?? "chat";
  if (n.tableId) return `${type}:t:${n.tableId}`;
  if (n.torneoId) return `${type}:r:${n.torneoId}`;
  if (n.compartidaId) return `${type}:c:${n.compartidaId}`;
  if (n.eventoId) return `${type}:e:${n.eventoId}`;
  if (n.communityId) return `${type}:cm:${n.communityId}`;
  if (n.fromUserId) return `${type}:u:${n.fromUserId}`;
  return type;
};

export const resourceKey = (n) => {
  const type = n.type ?? "chat";
  if (n.tableId) return `${type}:t:${n.tableId}`;
  if (n.torneoId) return `${type}:r:${n.torneoId}`;
  if (n.compartidaId) return `${type}:c:${n.compartidaId}`;
  if (n.eventoId) return `${type}:e:${n.eventoId}`;
  if (n.communityId) return `${type}:cm:${n.communityId}`;
  if (n.fromUserId) return `${type}:u:${n.fromUserId}`;
  return type;
};

export const mergeNotifs = (serverList, localList) => {
  // Indexamos por dos claves: ID exacto (cuando lo hay) Y resource key. Si
  // una notif local sin _id corresponde al mismo (type, resource) que una
  // del server, se considera la misma — el server gana porque tiene el
  // _id real y el count autoritativo.
  const byKey = new Map();
  const claim = (key, notif) => {
    if (key) byKey.set(key, notif);
  };
  serverList.forEach((n) => {
    claim(notifKey(n), n);
    claim(`res:${resourceKey(n)}`, n);
  });
  localList.forEach((n) => {
    const idKey = notifKey(n);
    const resKey = `res:${resourceKey(n)}`;
    if (byKey.has(idKey) || byKey.has(resKey)) return;
    claim(idKey, n);
    claim(resKey, n);
  });
  const seen = new Set();
  const out = [];
  byKey.forEach((notif) => {
    const id = notif.notifId || notif._id || `res:${resourceKey(notif)}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push(notif);
  });
  return out;
};

// ── Toasts ───────────────────────────────────────────────────────────

const makeToastId = () => `${Date.now()}-${Math.random()}`;

const toastDedupKey = (t) => {
  if (t.tableId) return `${t.type}:t:${t.tableId}`;
  if (t.torneoId) return `${t.type}:r:${t.torneoId}`;
  if (t.compartidaId) return `${t.type}:c:${t.compartidaId}`;
  if (t.eventoId) return `${t.type}:e:${t.eventoId}`;
  if (t.communityId) return `${t.type}:cm:${t.communityId}`;
  if (t.playId) return `${t.type}:p:${t.playId}`;
  if (t.fromUserId) return `${t.type}:u:${t.fromUserId}`;
  return t.type;
};

export const pushToast = (prev, toast) => {
  const key = toastDedupKey(toast);
  const filtered = prev.filter((t) => toastDedupKey(t) !== key);
  const next = [...filtered, { id: makeToastId(), ...toast }];
  return next.length > 4 ? next.slice(-4) : next;
};

// ── Section gating ───────────────────────────────────────────────────

// Mapea cada evento de socket a la sección de SiteConfig que lo controla.
// Si la sección está OFF para el user (y no es admin), el evento se
// descarta silenciosamente (defense-in-depth — el server no debería emitir
// pero el filtro extra evita bugs).
export const EVENT_SECTION = {
  "chat:notification": "mesas",
  "join:request": "mesas",
  "join:accepted": "mesas",
  "join:rejected": "mesas",
  "table:comment": "mesas",
  "table:image": "mesas",
  "table:spot-opened": "mesas",
  "table:cancelled": "mesas",
  "friend:request": "amigos",
  "friend:accepted": "amigos",
  "dm:message": "dms",
  "torneo:registration-accepted": "torneos",
  "torneo:registration-rejected": "torneos",
  "torneo:advanced": "torneos",
  "torneo:eliminated": "torneos",
  "torneo:started": "torneos",
  "torneo:finished": "torneos",
  "compartida:comment": "compartidas",
  "compartida:like": "compartidas",
  "noticia:published": "noticias",
  "evento:notification": "eventos",
  "community:join-request": "comunidades",
  "community:join-resolved": "comunidades",
  "bgg:play-shared": "bgwatch",
  "bgg:play-accepted": "bgwatch",
};

// Eventos de socket PERSONALES (persona-a-persona): no pertenecen a ninguna
// comunidad, así que en modo tenant (subdominio) NO se filtran por comunidad —
// se ven siempre. El resto de eventos de `EVENT_SECTION` son de contenido y, en
// modo tenant, se descartan si su `community` no es la del subdominio.
// (admin:message no pasa por `gated`, así que no hace falta listarlo acá.)
export const PERSONAL_EVENTS = new Set([
  "friend:request",
  "friend:accepted",
  "dm:message",
  // BG Watch: persona-a-persona, no pertenecen a ninguna comunidad → no se
  // filtran por comunidad en modo tenant (subdominio).
  "bgg:play-shared",
  "bgg:play-accepted",
]);

// ── Helpers internos para reducers ────────────────────────────────────

const findExisting = (prev, type, tableId) =>
  prev.find((n) => (n.type ?? "chat") === type && n.tableId === tableId);

// Upsert "aggregating" — server pushea `count` absoluto y `notifId`.
// Si existe una notif del mismo (type, resourceField=resourceId), la
// actualiza in-place; sino, agrega una nueva.
//
// NUNCA hacemos `n.count + 1` — el count viene del server.
const upsertAggregating = ({
  prev,
  type,
  resourceField,
  resourceId,
  notifId,
  count,
  timestamp,
  extra,
  actors,
}) => {
  // `actors` (array autoritativo del server) sólo se aplica si vino — evita
  // pisar el array existente con `undefined` en eventos sin actor.
  const actorPatch = actors ? { actors } : {};
  const idx = prev.findIndex(
    (n) => (n.type ?? "chat") === type && n[resourceField] === resourceId,
  );
  if (idx >= 0) {
    return prev.map((n, i) =>
      i === idx
        ? {
            ...n,
            _id: notifId || n._id,
            notifId: notifId || n.notifId,
            read: false,
            count,
            timestamp,
            ...extra,
            ...actorPatch,
          }
        : n,
    );
  }
  return [
    ...prev,
    {
      _id: notifId,
      notifId,
      type,
      [resourceField]: resourceId,
      count,
      read: false,
      timestamp,
      ...extra,
      ...actorPatch,
    },
  ];
};

// "Replacing" — count fijo (1), filtra cualquier notif previa del mismo
// (type, resource) y la reemplaza. Usado para eventos non-aggregating
// como join_accepted, join_rejected, spot_opened, table_cancelled,
// tournament_*, evento_*.
const replaceResource = ({
  prev,
  type,
  resourceField,
  resourceId,
  timestamp,
  count = 1,
  notifId,
  extra,
}) => {
  const rest = prev.filter(
    (n) => !(n.type === type && n[resourceField] === resourceId),
  );
  return [
    ...rest,
    {
      ...(notifId ? { _id: notifId, notifId } : {}),
      type,
      [resourceField]: resourceId,
      count,
      read: false,
      timestamp,
      ...extra,
    },
  ];
};

// ── Mesas / Tables ───────────────────────────────────────────────────

export function applyChatNotif({ setNotifications, setToasts, payload }) {
  setNotifications((prev) =>
    upsertAggregating({
      prev,
      type: "chat",
      resourceField: "tableId",
      resourceId: payload.tableId,
      notifId: payload.notifId,
      count: payload.count,
      timestamp: payload.timestamp,
      actors: payload.actors,
      extra: {
        tableName: payload.tableName,
        lastSenderUsername: payload.senderUsername,
        lastMessagePreview: payload.messagePreview,
      },
    }),
  );
  setToasts((prev) =>
    pushToast(prev, {
      type: "chat",
      tableId: payload.tableId,
      tableName: payload.tableName,
      senderUsername: payload.senderUsername,
      messagePreview: payload.messagePreview,
    }),
  );
}

export function applyCommentNotif({ setNotifications, setToasts, payload }) {
  setNotifications((prev) =>
    upsertAggregating({
      prev,
      type: "comment",
      resourceField: "tableId",
      resourceId: payload.tableId,
      notifId: payload.notifId,
      count: payload.count,
      timestamp: payload.timestamp,
      actors: payload.actors,
      extra: {
        tableName: payload.tableName,
        lastCommenterUsername: payload.commenterUsername,
        lastCommentPreview: payload.commentPreview,
      },
    }),
  );
  setToasts((prev) =>
    pushToast(prev, {
      type: "comment",
      tableId: payload.tableId,
      tableName: payload.tableName,
      commenterUsername: payload.commenterUsername,
      commentPreview: payload.commentPreview,
    }),
  );
}

export function applyImageNotif({ setNotifications, setToasts, payload }) {
  setNotifications((prev) =>
    upsertAggregating({
      prev,
      type: "image",
      resourceField: "tableId",
      resourceId: payload.tableId,
      notifId: payload.notifId,
      count: payload.count,
      timestamp: payload.timestamp,
      actors: payload.actors,
      extra: {
        tableName: payload.tableName,
        lastUploaderUsername: payload.uploaderUsername,
      },
    }),
  );
  setToasts((prev) =>
    pushToast(prev, {
      type: "image",
      tableId: payload.tableId,
      tableName: payload.tableName,
      uploaderUsername: payload.uploaderUsername,
    }),
  );
}

export function applyJoinRequestNotif({
  setNotifications,
  setToasts,
  payload,
}) {
  setNotifications((prev) =>
    upsertAggregating({
      prev,
      type: "join_request",
      resourceField: "tableId",
      resourceId: payload.tableId,
      notifId: payload.notifId,
      count: payload.count,
      timestamp: payload.timestamp,
      actors: payload.actors,
      extra: {
        tableName: payload.tableName,
        lastRequesterUsername: payload.requesterUsername,
      },
    }),
  );
  setToasts((prev) =>
    pushToast(prev, {
      type: "join_request",
      tableId: payload.tableId,
      tableName: payload.tableName,
      requesterUsername: payload.requesterUsername,
    }),
  );
}

export function applyPlayerJoinedNotif({
  setNotifications,
  setToasts,
  payload,
}) {
  setNotifications((prev) =>
    upsertAggregating({
      prev,
      type: "player_joined",
      resourceField: "tableId",
      resourceId: payload.tableId,
      notifId: payload.notifId,
      count: payload.count,
      timestamp: payload.timestamp,
      actors: payload.actors,
      extra: {
        tableName: payload.tableName,
        lastJoinerUsername: payload.joinerUsername,
      },
    }),
  );
  setToasts((prev) =>
    pushToast(prev, {
      type: "player_joined",
      tableId: payload.tableId,
      tableName: payload.tableName,
      joinerUsername: payload.joinerUsername,
    }),
  );
}

export function applyPlayerLeftNotif({ setNotifications, setToasts, payload }) {
  setNotifications((prev) =>
    upsertAggregating({
      prev,
      type: "player_left",
      resourceField: "tableId",
      resourceId: payload.tableId,
      notifId: payload.notifId,
      count: payload.count,
      timestamp: payload.timestamp,
      actors: payload.actors,
      extra: {
        tableName: payload.tableName,
        lastLeaverUsername: payload.leaverUsername,
      },
    }),
  );
  setToasts((prev) =>
    pushToast(prev, {
      type: "player_left",
      tableId: payload.tableId,
      tableName: payload.tableName,
      leaverUsername: payload.leaverUsername,
    }),
  );
}

export function applyJoinAcceptedNotif({
  setNotifications,
  setToasts,
  payload,
}) {
  setNotifications((prev) =>
    replaceResource({
      prev,
      type: "join_accepted",
      resourceField: "tableId",
      resourceId: payload.tableId,
      timestamp: payload.timestamp,
      extra: { tableName: payload.tableName },
    }),
  );
  setToasts((prev) =>
    pushToast(prev, {
      type: "join_accepted",
      tableId: payload.tableId,
      tableName: payload.tableName,
    }),
  );
}

export function applyJoinRejectedNotif({
  setNotifications,
  setToasts,
  payload,
}) {
  setNotifications((prev) =>
    replaceResource({
      prev,
      type: "join_rejected",
      resourceField: "tableId",
      resourceId: payload.tableId,
      timestamp: payload.timestamp,
      extra: { tableName: payload.tableName },
    }),
  );
  setToasts((prev) =>
    pushToast(prev, {
      type: "join_rejected",
      tableId: payload.tableId,
      tableName: payload.tableName,
    }),
  );
}

export function applySpotOpenedNotif({ setNotifications, setToasts, payload }) {
  setNotifications((prev) =>
    replaceResource({
      prev,
      type: "spot_opened",
      resourceField: "tableId",
      resourceId: payload.tableId,
      timestamp: payload.timestamp,
      extra: { tableName: payload.tableName },
    }),
  );
  setToasts((prev) =>
    pushToast(prev, {
      type: "spot_opened",
      tableId: payload.tableId,
      tableName: payload.tableName,
    }),
  );
}

export function applyTableCancelledNotif({
  setNotifications,
  setToasts,
  payload,
}) {
  setNotifications((prev) =>
    replaceResource({
      prev,
      type: "table_cancelled",
      resourceField: "tableId",
      resourceId: payload.tableId,
      timestamp: payload.timestamp,
      extra: { tableName: payload.tableName },
    }),
  );
  setToasts((prev) =>
    pushToast(prev, {
      type: "table_cancelled",
      tableId: payload.tableId,
      tableName: payload.tableName,
    }),
  );
}

// ── Friends ───────────────────────────────────────────────────────────

// Friend notifs deduplican por (type, fromUserId) — si ya existe una del
// mismo origen, no se duplica. Esto difiere de los reducers de tables:
// acá la idea es "una sola card por friend pendiente" en vez de incrementar
// count.
function pushFriendNotif(prev, type, payload) {
  const existing = prev.find(
    (n) => n.type === type && n.fromUserId === payload.fromUserId,
  );
  if (existing) return prev;
  return [
    ...prev,
    {
      type,
      fromUserId: payload.fromUserId,
      fromUsername: payload.fromUsername,
      count: 1,
      read: false,
      timestamp: new Date().toISOString(),
    },
  ];
}

export function applyFriendRequestNotif({
  setNotifications,
  setToasts,
  payload,
}) {
  setNotifications((prev) => pushFriendNotif(prev, "friend_request", payload));
  setToasts((prev) =>
    pushToast(prev, {
      type: "friend_request",
      fromUserId: payload.fromUserId,
      fromUsername: payload.fromUsername,
    }),
  );
}

export function applyFriendAcceptedNotif({
  setNotifications,
  setToasts,
  payload,
  onAccepted,
}) {
  setNotifications((prev) => pushFriendNotif(prev, "friend_accepted", payload));
  setToasts((prev) =>
    pushToast(prev, {
      type: "friend_accepted",
      fromUserId: payload.fromUserId,
      fromUsername: payload.fromUsername,
    }),
  );
  onAccepted?.();
}

// ── DM ───────────────────────────────────────────────────────────────

export function applyDmMessageNotif({ setNotifications, payload, onMessage }) {
  const fromId = (payload.from?._id || payload.from || "").toString();
  const fromUsername = payload.from?.username || "?";
  const preview = (payload.content || "").slice(0, 60);
  // count + notifId vienen en el payload (post-emitNotification).
  // Fallback a +1 / nuevo doc para resistir payloads viejos durante deploy.
  const incomingCount =
    typeof payload.count === "number" ? payload.count : null;
  const incomingNotifId = payload.notifId || null;

  setNotifications((prev) => {
    const existing = prev.find(
      (n) => n.type === "dm" && n.fromUserId === fromId,
    );
    if (existing) {
      return prev.map((n) =>
        n.type === "dm" && n.fromUserId === fromId
          ? {
              ...n,
              _id: incomingNotifId || n._id,
              notifId: incomingNotifId || n.notifId,
              read: false,
              count: incomingCount ?? (n.count || 1) + 1,
              lastMessagePreview: preview,
              fromUsername,
              timestamp: payload.timestamp || new Date().toISOString(),
            }
          : n,
      );
    }
    return [
      ...prev,
      {
        _id: incomingNotifId,
        notifId: incomingNotifId,
        type: "dm",
        fromUserId: fromId,
        fromUsername,
        lastMessagePreview: preview,
        count: incomingCount ?? 1,
        read: false,
        timestamp: payload.timestamp || new Date().toISOString(),
      },
    ];
  });

  onMessage?.(payload);
}

// ── Admin chat ───────────────────────────────────────────────────────

export function applyAdminMessageNotif({
  setNotifications,
  payload,
  isActive,
}) {
  const senderUsername = payload.from?.username || "?";
  const preview = (payload.content || "").slice(0, 60);
  const incomingCount =
    typeof payload.count === "number" ? payload.count : null;
  const incomingNotifId = payload.notifId || null;

  if (isActive?.()) {
    // El user ya está mirando el admin chat → marcar leído en server, no
    // generar notif local. (El listener de chat aparte mostrará el mensaje
    // directamente.)
    axios.patch(API.adminChat.READ).catch(() => {});
    return;
  }

  setNotifications((prev) => {
    const existing = prev.find((n) => n.type === "admin_chat");
    if (existing) {
      return prev.map((n) =>
        n.type === "admin_chat"
          ? {
              ...n,
              _id: incomingNotifId || n._id,
              notifId: incomingNotifId || n.notifId,
              read: false,
              count: incomingCount ?? (n.count || 1) + 1,
              lastSenderUsername: senderUsername,
              lastMessagePreview: preview,
              ...(payload.actors ? { actors: payload.actors } : {}),
              timestamp: payload.timestamp || new Date().toISOString(),
            }
          : n,
      );
    }
    return [
      ...prev,
      {
        _id: incomingNotifId,
        notifId: incomingNotifId,
        type: "admin_chat",
        lastSenderUsername: senderUsername,
        lastMessagePreview: preview,
        ...(payload.actors ? { actors: payload.actors } : {}),
        count: incomingCount ?? 1,
        read: false,
        timestamp: payload.timestamp || new Date().toISOString(),
      },
    ];
  });
}

// ── Torneos ──────────────────────────────────────────────────────────

// Los 6 eventos de torneos son no-aggregating con count=1 y solo difieren
// en el `type`. Una sola función parametrizada cubre los 6.
export function applyTorneoNotif({
  setNotifications,
  setToasts,
  payload,
  type,
}) {
  setNotifications((prev) =>
    replaceResource({
      prev,
      type,
      resourceField: "torneoId",
      resourceId: payload.torneoId,
      timestamp: payload.timestamp || new Date().toISOString(),
      extra: {
        torneoTitle: payload.torneoTitle,
        round: payload.round,
        isPhase: payload.isPhase || false,
      },
    }),
  );
  setToasts((prev) =>
    pushToast(prev, {
      type,
      torneoId: payload.torneoId,
      torneoTitle: payload.torneoTitle,
      round: payload.round,
      isPhase: payload.isPhase || false,
    }),
  );
}

// ── Compartidas ──────────────────────────────────────────────────────

export function applyCompartidaCommentNotif({
  setNotifications,
  setToasts,
  payload,
}) {
  setNotifications((prev) =>
    upsertAggregating({
      prev,
      type: "compartida_comment",
      resourceField: "compartidaId",
      resourceId: payload.compartidaId,
      notifId: payload.notifId,
      count: payload.count,
      timestamp: payload.timestamp,
      actors: payload.actors,
      extra: {
        compartidaTitle: payload.compartidaTitle,
        lastCommenterUsername: payload.commenterUsername,
        lastCommentPreview: payload.commentPreview,
      },
    }),
  );
  setToasts((prev) =>
    pushToast(prev, {
      type: "compartida_comment",
      compartidaId: payload.compartidaId,
      compartidaTitle: payload.compartidaTitle,
      commenterUsername: payload.commenterUsername,
      commentPreview: payload.commentPreview,
    }),
  );
}

export function applyCompartidaLikeNotif({
  setNotifications,
  setToasts,
  payload,
}) {
  setNotifications((prev) =>
    upsertAggregating({
      prev,
      type: "compartida_like",
      resourceField: "compartidaId",
      resourceId: payload.compartidaId,
      notifId: payload.notifId,
      count: payload.count,
      timestamp: payload.timestamp,
      actors: payload.actors,
      extra: {
        compartidaTitle: payload.compartidaTitle,
        lastSenderUsername: payload.fromUsername,
      },
    }),
  );
  setToasts((prev) =>
    pushToast(prev, {
      type: "compartida_like",
      compartidaId: payload.compartidaId,
      compartidaTitle: payload.compartidaTitle,
      fromUsername: payload.fromUsername,
    }),
  );
}

// ── Noticias ─────────────────────────────────────────────────────────

export function applyNoticiaPublishedNotif({ setToasts, payload }) {
  // Noticias no se persisten — solo toast.
  setToasts((prev) =>
    pushToast(prev, {
      type: "noticia",
      noticiaId: payload.noticiaId,
      title: payload.title,
    }),
  );
}

// ── Eventos ──────────────────────────────────────────────────────────

// Único listener para los 7 tipos de evento. El payload trae `type` short
// ("confirmed") o ya largo ("evento_confirmed") — soportamos ambos.
export const EVENTO_TYPE_MAP = {
  confirmed: "evento_confirmed",
  rejected: "evento_rejected",
  cancelled: "evento_cancelled",
  updated: "evento_updated",
  reminder: "evento_reminder",
  // Sub-recursos del evento (Fase 2). Llegan agregables — el count viene
  // del server (contrato post-emitNotification: payload.count).
  ludoteca_added: "evento_ludoteca_added",
  mesa_created: "evento_mesa_created",
};

export function applyEventoNotif({
  setNotifications,
  setToasts,
  payload,
  isActive,
}) {
  const rawType = payload?.type || "";
  const notifType = EVENTO_TYPE_MAP[rawType] || rawType;
  if (!notifType || !notifType.startsWith("evento_")) return;

  const common = {
    type: notifType,
    eventoId: payload.eventoId,
    eventoTitle: payload.eventoTitle,
    eventoDate: payload.eventoDate || null,
    permanentlyRejected: payload.permanentlyRejected || false,
    changedFields: payload.changedFields || undefined,
    // Flag para distinguir cancelación (el evento existe) vs eliminación
    // (el evento ya no existe → el deep-link a /eventos/:id rompería).
    eventoDeleted: payload.eventoDeleted || false,
    // Sub-recursos: payload trae metadata adicional (last game name, etc.)
    gameName: payload.gameName || "",
    addedByUsername: payload.addedByUsername || "",
    eventoTableId: payload.eventoTableId || null,
    hostUsername: payload.hostUsername || "",
  };
  // `count` absoluto del server cuando viene (aggregating types post-
  // emitNotification). Fallback a 1 para los tipos non-aggregating.
  const incomingCount = typeof payload.count === "number" ? payload.count : 1;
  const incomingNotifId = payload.notifId || null;

  setNotifications((prev) =>
    replaceResource({
      prev,
      type: notifType,
      resourceField: "eventoId",
      resourceId: common.eventoId,
      timestamp: payload.timestamp || new Date().toISOString(),
      notifId: incomingNotifId,
      count: incomingCount,
      extra: common,
    }),
  );

  // Si el user está viendo el detalle del evento, no toasteamos — el
  // evento ya está visible en pantalla (mismo patrón que mesas).
  // La notif persistente igual se guarda y se marca leída por
  // setActiveEvento → markReadEvento.
  if (isActive?.(common.eventoId)) return;
  setToasts((prev) => pushToast(prev, common));
}

// ── Comunidades ──────────────────────────────────────────────────────

// Solicitud de unión a una comunidad (a subadmins/admins). AGGREGATING:
// varias solicitudes a la misma comunidad → una notif con count + actors
// apilados (el server pushea ambos). El requester más reciente sale en
// actors[0].
export function applyCommunityJoinRequestNotif({
  setNotifications,
  setToasts,
  payload,
}) {
  setNotifications((prev) =>
    upsertAggregating({
      prev,
      type: "community_join_request",
      resourceField: "communityId",
      resourceId: payload.communityId,
      notifId: payload.notifId,
      count: payload.count,
      timestamp: payload.timestamp,
      actors: payload.actors,
      extra: {
        communityName: payload.communityName,
        communitySlug: payload.communitySlug,
      },
    }),
  );
  setToasts((prev) =>
    pushToast(prev, {
      type: "community_join_request",
      communityId: payload.communityId,
      communityName: payload.communityName,
      communitySlug: payload.communitySlug,
      requesterUsername: payload.actors?.[0]?.username || "Alguien",
    }),
  );
}

// Resolución de una solicitud (al solicitante). `payload.resolution`
// discrimina accepted/rejected (el server lo manda como `extra`). Side-effect
// `onResolved` → recarga las memberships del CommunityContext.
export function applyCommunityJoinResolvedNotif({
  setNotifications,
  setToasts,
  payload,
  onResolved,
}) {
  const accepted = payload.resolution !== "rejected";
  const type = accepted ? "community_join_accepted" : "community_join_rejected";
  const extra = {
    communityName: payload.communityName,
    communitySlug: payload.communitySlug,
  };
  setNotifications((prev) =>
    replaceResource({
      prev,
      type,
      resourceField: "communityId",
      resourceId: payload.communityId,
      timestamp: payload.timestamp || new Date().toISOString(),
      notifId: payload.notifId,
      extra,
    }),
  );
  setToasts((prev) =>
    pushToast(prev, { type, communityId: payload.communityId, ...extra }),
  );
  onResolved?.();
}

// ── BG Watch — partida compartida ────────────────────────────────────

// Un co-jugador recibe una partida que el autor cargó (con él en el roster).
// No-aggregating, keyed por `playId` (cada partida = su propia notif). El
// snapshot embebido viaja en el payload → la tarjeta se pinta sin refetch.
export function applyBggPlaySharedNotif({
  setNotifications,
  setToasts,
  payload,
}) {
  setNotifications((prev) =>
    replaceResource({
      prev,
      type: "bgg_play_shared",
      resourceField: "playId",
      resourceId: payload.playId,
      timestamp: payload.timestamp || new Date().toISOString(),
      notifId: payload.notifId,
      count: 1,
      extra: {
        fromUserId: payload.fromUserId,
        fromUsername: payload.fromUsername,
        gameName: payload.gameName,
        playSnapshot: payload.playSnapshot,
      },
    }),
  );
  setToasts((prev) =>
    pushToast(prev, {
      type: "bgg_play_shared",
      playId: payload.playId,
      fromUsername: payload.fromUsername,
      gameName: payload.gameName,
    }),
  );
}

// Al autor: un co-jugador cargó la partida que compartió (agradecimiento).
export function applyBggPlayAcceptedNotif({
  setNotifications,
  setToasts,
  payload,
}) {
  setNotifications((prev) =>
    replaceResource({
      prev,
      type: "bgg_play_accepted",
      resourceField: "playId",
      resourceId: payload.playId,
      timestamp: payload.timestamp || new Date().toISOString(),
      notifId: payload.notifId,
      count: 1,
      extra: {
        fromUserId: payload.fromUserId,
        fromUsername: payload.fromUsername,
        gameName: payload.gameName,
      },
    }),
  );
  setToasts((prev) =>
    pushToast(prev, {
      type: "bgg_play_accepted",
      playId: payload.playId,
      fromUserId: payload.fromUserId,
      fromUsername: payload.fromUsername,
      gameName: payload.gameName,
    }),
  );
}

// ── markRead helpers ─────────────────────────────────────────────────

// Resetea count: 0 al marcar leído. Sin esto los counters de tipos
// agregables crecen monótonamente entre sesiones — el bug "doble conteo"
// percibido por el usuario. El próximo evento llega con count absoluto
// desde el server y restaura el valor real.
const resetRead = (n) => ({ ...n, read: true, count: 0 });

export function markReadByPredicate(notifications, predicate) {
  return notifications.map((n) => (predicate(n) ? resetRead(n) : n));
}

// Marca una notif puntual (por id) como cargada: leída, count 0 y `playLoaded`,
// para que la tarjeta de partida compartida (`bgg_play_shared`) deje de mostrar
// los botones de carga y quede como una notif común. A diferencia de `dismiss`,
// NO la saca de la bandeja: sigue ahí hasta que el usuario la limpie.
export function markPlayLoadedById(notifications, id) {
  return notifications.map((n) =>
    (n.notifId || n._id) === id
      ? { ...n, read: true, count: 0, playLoaded: true }
      : n,
  );
}

// Para evitar callers re-importando findExisting que ya no es público,
// lo dejamos exportable por si algún test lo necesita.
export { findExisting };
