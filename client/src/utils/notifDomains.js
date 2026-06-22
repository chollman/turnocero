// Registro central de dominios de notificación para la bandeja
// (`/notificaciones`). Mapea los tipos del backend (server/models/Notification.js)
// a 6 dominios con color de marca + icono, y arma el copy (title/body/cta) de
// cada fila. Antes esta lógica vivía embebida en un switch gigante dentro de
// Notifications.jsx — extraída acá para testearla una sola vez.

// type del backend → dominio de UI.
export const TYPE_DOMAIN = {
  // Mesas
  chat: "mesa",
  comment: "mesa",
  image: "mesa",
  join_request: "mesa",
  join_accepted: "mesa",
  join_rejected: "mesa",
  player_joined: "mesa",
  player_left: "mesa",
  spot_opened: "mesa",
  table_cancelled: "mesa",
  // Amigos / mensajes directos
  friend_request: "amigo",
  friend_accepted: "amigo",
  dm: "amigo",
  // Compartidas
  compartida_comment: "compartida",
  compartida_like: "compartida",
  compartida_comment_like: "compartida",
  // Mesas — like de comentario
  comment_like: "mesa",
  // Torneos
  tournament_accepted: "torneo",
  tournament_rejected: "torneo",
  tournament_advanced: "torneo",
  tournament_eliminated: "torneo",
  tournament_started: "torneo",
  tournament_finished: "torneo",
  // Eventos
  evento_confirmed: "evento",
  evento_rejected: "evento",
  evento_cancelled: "evento",
  evento_updated: "evento",
  evento_reminder: "evento",
  evento_ludoteca_added: "evento",
  evento_mesa_created: "evento",
  // Math Trade
  mathtrade_results: "mathtrade",
  // Comunidades
  community_join_request: "comunidad",
  community_join_accepted: "comunidad",
  community_join_rejected: "comunidad",
  community_content_removed: "comunidad",
  // BG Watch — partida compartida
  bgg_play_shared: "bgwatch",
  bgg_play_accepted: "bgwatch",
  // Admin chat
  admin_chat: "admin",
};

// Metadata por dominio. `colorVar` es un token de marca de index.css — se
// inyecta en cada fila como `--rowColor` y se usa para barra de no-leída,
// icono, pip y tintes. `icon` es la key dentro de NotifIcons.
// Preparado para sumar noticia/bgwatch/sistema cuando esos notifs existan.
// La label de cada dominio se traduce vía i18n (ns `notifs:domains.<dominio>`);
// acá quedan solo los tokens visuales (colorVar + icon).
export const DOMAIN_META = {
  mesa: { colorVar: "--amber", icon: "Dice" },
  evento: { colorVar: "--purple", icon: "Calendar" },
  torneo: { colorVar: "--orange", icon: "Trophy" },
  amigo: { colorVar: "--green", icon: "Users" },
  compartida: { colorVar: "--red", icon: "Heart" },
  mathtrade: { colorVar: "--green", icon: "Swap" },
  comunidad: { colorVar: "--purple", icon: "Community" },
  bgwatch: { colorVar: "--green", icon: "Dice" },
  admin: { colorVar: "--text-muted", icon: "Megaphone" },
};

export const getDomain = (type) => TYPE_DOMAIN[type] || "mesa";
export const getDomainMeta = (type) => DOMAIN_META[getDomain(type)];

// Label traducida del dominio de un tipo de notif. `t` viene de useTranslation().
export function getDomainLabel(type, t) {
  return t(`notifs:domains.${getDomain(type)}`);
}

// Tipos que el usuario puede resolver inline desde la bandeja (aceptar/rechazar).
export const ACTIONABLE_TYPES = new Set(["friend_request", "join_request"]);
export const isActionable = (n) => ACTIONABLE_TYPES.has(n?.type) && !n?.read;

// Tipos agregables → mostramos un badge numérico con `count` cuando > 1.
const COUNT_BADGE_TYPES = new Set([
  "chat",
  "comment",
  "image",
  "join_request",
  "player_joined",
  "player_left",
  "dm",
  "admin_chat",
  "compartida_comment",
  "compartida_like",
  "compartida_comment_like",
  "comment_like",
  "evento_ludoteca_added",
  "evento_mesa_created",
  "community_join_request",
]);

export const getCountBadge = (n) =>
  COUNT_BADGE_TYPES.has(n?.type) && (n?.count || 0) > 1 ? n.count : null;

// ── Buckets de tiempo (Hoy / Esta semana / Antes) ──────────────────────
// Orden de render; las labels se traducen vía getBucketLabel(key, t).
export const NOTIF_BUCKET_KEYS = ["today", "week", "earlier"];

export function getBucketLabel(key, t) {
  return t(`notifs:buckets.${key}`);
}

export function notifBucket(date, now = Date.now()) {
  const d = new Date(date);
  const ts = d.getTime();
  if (isNaN(ts)) return "earlier";
  const sameDay = d.toDateString() === new Date(now).toDateString();
  if (sameDay) return "today";
  if ((now - ts) / 86400000 < 7) return "week";
  return "earlier";
}

// ── Ruta de navegación del recurso ─────────────────────────────────────
export function notifLink(n) {
  if (n.type === "admin_chat") return "/mensajes-admin";
  if (n.type === "dm") return `/mensajes/${n.fromUserId}`;
  if (n.compartidaId) return `/compartidas/${n.compartidaId}`;
  if (n.type?.startsWith("evento_")) {
    // Evento eliminado: el detalle tira 404 → mandamos a la lista.
    return n.eventoDeleted ? "/eventos" : `/eventos/${n.eventoId}`;
  }
  if (n.type?.startsWith("tournament_")) return `/torneos/${n.torneoId}`;
  if (n.type?.startsWith("mathtrade_")) return `/math-trade/${n.mathtradeId}`;
  if (n.type?.startsWith("community_")) {
    if (!n.communitySlug) return "/comunidades";
    // Una solicitud de unión se resuelve desde la gestión de la comunidad;
    // el resto (te aceptaron/rechazaron/bajaron contenido) va al detalle.
    return n.type === "community_join_request"
      ? `/comunidades/${n.communitySlug}/gestion`
      : `/comunidades/${n.communitySlug}`;
  }
  if (n.fromUserId) return `/usuarios/${n.fromUserId}`;
  return `/mesas/${n.tableId}`;
}

// Nombre del recurso (para el `target` del topline: "· Catán").
export function notifTarget(n) {
  if (n.type === "admin_chat") return "Chat de admins";
  return (
    n.tableName ||
    n.torneoTitle ||
    n.compartidaTitle ||
    n.eventoTitle ||
    n.mathtradeTitle ||
    n.communityName ||
    n.fromUsername ||
    null
  );
}

const trunc = (s, max = 60) => (s ? `${s}${s.length >= max ? "…" : ""}` : "");

// ── Copy por tipo: { title, body, cta } ─────────────────────────────────
// title = línea principal · body = subtexto · cta = label del botón ghost.
// `t` es el `t` de i18next (react-i18next en la app; instancia standalone en
// el SW vía notifT()). Todo literal Spanish ahora sale del ns `notifs`; la
// lógica condicional (branches, fallbacks) se queda en JS.
export function getNotifMeta(n, t) {
  const k = (key, vars) => t(`notifs:${n.type}.${key}`, vars);
  switch (n.type) {
    case "join_request":
      return {
        title: k("title", { count: n.count || 1, username: n.lastRequesterUsername }),
        body: n.tableName ? k("bodyTable", { tableName: n.tableName }) : "",
        cta: k("cta"),
      };
    case "join_accepted":
      return {
        title: k("title"),
        body: k("body", { tableName: n.tableName }),
        cta: k("cta"),
      };
    case "join_rejected":
      return {
        title: k("title"),
        body: k("body", { tableName: n.tableName }),
        cta: k("cta"),
      };
    case "player_joined":
      return {
        title: k("title", { count: n.count || 1, username: n.lastJoinerUsername }),
        body: n.tableName ? k("bodyTable", { tableName: n.tableName }) : "",
        cta: k("cta"),
      };
    case "player_left":
      return {
        title: k("title", { count: n.count || 1, username: n.lastLeaverUsername }),
        body: n.tableName ? k("bodyTable", { tableName: n.tableName }) : "",
        cta: k("cta"),
      };
    case "spot_opened":
      return {
        title: k("title"),
        body: k("body", { tableName: n.tableName }),
        cta: k("cta"),
      };
    case "table_cancelled":
      return {
        title: k("title"),
        body: k("body", { tableName: n.tableName }),
        cta: null,
      };
    case "chat":
      return {
        title: k("title", { count: n.count || 1 }),
        body: `${n.lastSenderUsername}: ${trunc(n.lastMessagePreview)}`,
        cta: k("cta"),
      };
    case "comment": {
      // Copy neutral: el destinatario puede ser el host O alguien que también
      // comentó el hilo (respuestas), así que no decimos "tu mesa".
      const where = n.tableName
        ? k("whereTable", { tableName: n.tableName })
        : k("whereGeneric");
      return {
        title: k("title", {
          count: n.count || 1,
          username: n.lastCommenterUsername,
          where,
        }),
        body: trunc(n.lastCommentPreview),
        cta: k("cta"),
      };
    }
    case "image":
      return {
        title: k("title", { count: n.count || 1 }),
        body: k("body", { count: n.count || 1, username: n.lastUploaderUsername }),
        cta: k("cta"),
      };
    case "friend_request":
      return {
        title: k("title", { username: n.fromUsername }),
        body: "",
        cta: k("cta"),
      };
    case "friend_accepted":
      return {
        title: k("title", { username: n.fromUsername }),
        body: k("body"),
        cta: k("cta"),
      };
    case "dm":
      return {
        title: k("title", { count: n.count || 1, username: n.fromUsername }),
        body: trunc(n.lastMessagePreview),
        cta: k("cta"),
      };
    case "admin_chat":
      return {
        title: k("title", { count: n.count || 1 }),
        body: `${n.lastSenderUsername}: ${trunc(n.lastMessagePreview)}`,
        cta: k("cta"),
      };
    case "compartida_comment": {
      // Copy neutral: el destinatario puede ser el autor del post O alguien
      // que también comentó el hilo, así que no decimos "tu compartida".
      const where = n.compartidaTitle
        ? k("whereTitle", { compartidaTitle: n.compartidaTitle })
        : k("whereGeneric");
      return {
        title: k("title", {
          count: n.count || 1,
          username: n.lastCommenterUsername,
          where,
        }),
        body: trunc(n.lastCommentPreview),
        cta: k("cta"),
      };
    }
    case "compartida_like":
      return {
        title: k("title", {
          count: n.count,
          username: n.lastSenderUsername,
          others: n.count - 1,
        }),
        body: n.compartidaTitle
          ? k("body", { compartidaTitle: n.compartidaTitle })
          : "",
        cta: k("cta"),
      };
    case "compartida_comment_like":
      return {
        title: k("title", {
          count: n.count,
          username: n.lastSenderUsername,
          others: n.count - 1,
        }),
        body: n.compartidaTitle
          ? k("body", { compartidaTitle: n.compartidaTitle })
          : "",
        cta: k("cta"),
      };
    case "comment_like":
      return {
        title: k("title", {
          count: n.count,
          username: n.lastSenderUsername,
          others: n.count - 1,
        }),
        body: n.tableName ? k("body", { tableName: n.tableName }) : "",
        cta: k("cta"),
      };
    case "tournament_accepted":
      return {
        title: k("title"),
        body: k("body", { torneoTitle: n.torneoTitle || k("fallbackTorneo") }),
        cta: k("cta"),
      };
    case "tournament_rejected":
      return {
        title: k("title"),
        body: k("body"),
        cta: k("cta"),
      };
    case "tournament_advanced": {
      const label = n.isPhase ? k("labelPhase") : k("labelRound");
      const nextNum = n.round != null ? n.round + 1 : null;
      return {
        title: k("title", { label }),
        body:
          nextNum != null
            ? k("bodyNumbered", { label, nextNum })
            : k("bodyNext", { label }),
        cta: k("cta"),
      };
    }
    case "tournament_eliminated":
      return {
        title: k("title"),
        body: k("body"),
        cta: k("cta"),
      };
    case "tournament_started":
      return {
        title: k("title"),
        body: k("body", { torneoTitle: n.torneoTitle || k("fallbackTorneo") }),
        cta: k("cta"),
      };
    case "tournament_finished":
      return {
        title: k("title"),
        body: k("body", { torneoTitle: n.torneoTitle || k("fallbackTorneo") }),
        cta: k("cta"),
      };
    case "evento_confirmed":
      return {
        title: k("title"),
        body: k("body", { eventoTitle: n.eventoTitle }),
        cta: k("cta"),
      };
    case "evento_rejected":
      return {
        title: n.permanentlyRejected ? k("titlePermanent") : k("title"),
        body: n.permanentlyRejected
          ? k("bodyPermanent", { eventoTitle: n.eventoTitle })
          : k("body", { eventoTitle: n.eventoTitle }),
        cta: n.permanentlyRejected ? null : k("cta"),
      };
    case "evento_cancelled":
      return {
        title: n.eventoDeleted ? k("titleDeleted") : k("title"),
        body: n.eventoDeleted
          ? k("bodyDeleted", { eventoTitle: n.eventoTitle })
          : k("body", { eventoTitle: n.eventoTitle }),
        cta: n.eventoDeleted ? k("ctaDeleted") : k("cta"),
      };
    case "evento_updated": {
      const fields = Array.isArray(n.changedFields) ? n.changedFields : [];
      const labels = fields.map((f) =>
        f === "eventDate"
          ? k("fieldDate")
          : f === "location"
            ? k("fieldLocation")
            : f,
      );
      const detail = labels.length > 0 ? labels.join(" + ") : k("detailFallback");
      return {
        title: k("title"),
        body: k("body", { eventoTitle: n.eventoTitle, detail }),
        cta: k("cta"),
      };
    }
    case "evento_reminder":
      return {
        title: k("title", { eventoTitle: n.eventoTitle }),
        body: k("body"),
        cta: k("cta"),
      };
    case "evento_ludoteca_added": {
      const who = n.addedByUsername || k("fallbackWho");
      const game = n.gameName ? `“${n.gameName}”` : k("fallbackGame");
      return {
        title: k("title", { count: n.count || 1, who }),
        body: k("body", { who, game, eventoTitle: n.eventoTitle }),
        cta: k("cta"),
      };
    }
    case "evento_mesa_created": {
      const who = n.hostUsername || k("fallbackWho");
      const game = n.gameName ? `“${n.gameName}”` : k("fallbackGame");
      return {
        title: k("title", { count: n.count || 1, who }),
        body: k("body", { who, game, eventoTitle: n.eventoTitle }),
        cta: k("cta"),
      };
    }
    case "mathtrade_results":
      return {
        title: k("title"),
        body: k("body", {
          mathtradeTitle: n.mathtradeTitle || k("fallbackMathtrade"),
        }),
        cta: k("cta"),
      };
    case "community_join_request": {
      const who = n.actors?.[0]?.username || k("fallbackWho");
      return {
        title: k("title", {
          count: n.count || 1,
          who,
          communityName: n.communityName || k("fallbackCommunity"),
        }),
        body: k("body"),
        cta: k("cta"),
      };
    }
    case "community_join_accepted":
      return {
        title: k("title"),
        body: k("body", { communityName: n.communityName || k("fallbackCommunity") }),
        cta: k("cta"),
      };
    case "community_join_rejected":
      return {
        title: k("title"),
        body: k("body", { communityName: n.communityName || k("fallbackCommunity") }),
        cta: k("cta"),
      };
    case "community_content_removed":
      return {
        title: k("title"),
        body: k("body", { communityName: n.communityName || k("fallbackCommunity") }),
        cta: k("cta"),
      };
    case "bgg_play_shared": {
      const game = n.gameName ? `“${n.gameName}”` : k("fallbackGame");
      return {
        title: k("title", { who: n.fromUsername || k("fallbackWho") }),
        body: k("body", { game }),
        cta: k("cta"),
      };
    }
    case "bgg_play_accepted": {
      const game = n.gameName ? `“${n.gameName}”` : k("fallbackGame");
      return {
        title: k("title", { who: n.fromUsername || k("fallbackWho") }),
        body: k("body", { game }),
        cta: k("cta"),
      };
    }
    default:
      return {
        title: t("notifs:default.title"),
        body: trunc(n.lastMessagePreview),
        cta: null,
      };
  }
}
