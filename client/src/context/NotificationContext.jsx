import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { io } from "socket.io-client";
import axios from "axios";
import { useAuth } from "./AuthContext";
import { useSiteConfig } from "./SiteConfigContext";

const NotificationContext = createContext(null);
const makeToastId = () => `${Date.now()}-${Math.random()}`;

const findExisting = (prev, type, tableId) =>
  prev.find((n) => (n.type ?? "chat") === type && n.tableId === tableId);

const notifKey = (n) => {
  // Cuando viene del server con _id (post-refactor), usamos ese como key
  // exacta — dedup determinístico y no susceptible a races de timestamp.
  const id = n.notifId || n._id;
  if (id) return `id:${id}`;
  // Fallback para notifs creadas localmente antes de recibir el doc del server.
  const type = n.type ?? "chat";
  if (n.tableId) return `${type}:t:${n.tableId}`;
  if (n.torneoId) return `${type}:r:${n.torneoId}`;
  if (n.compartidaId) return `${type}:c:${n.compartidaId}`;
  if (n.eventoId) return `${type}:e:${n.eventoId}`;
  if (n.fromUserId) return `${type}:u:${n.fromUserId}`;
  return type;
};

// Resource-level key — usado por listeners que necesitan encontrar/reemplazar
// la notif existente del mismo (type, resource) sin importar su _id (puede
// que el _id local no esté seteado aún si el socket llegó antes del GET).
const resourceKey = (n) => {
  const type = n.type ?? "chat";
  if (n.tableId) return `${type}:t:${n.tableId}`;
  if (n.torneoId) return `${type}:r:${n.torneoId}`;
  if (n.compartidaId) return `${type}:c:${n.compartidaId}`;
  if (n.eventoId) return `${type}:e:${n.eventoId}`;
  if (n.fromUserId) return `${type}:u:${n.fromUserId}`;
  return type;
};

const mergeNotifs = (serverList, localList) => {
  // Indexamos por dos claves: ID exacto (cuando lo hay) Y resource key. Si una
  // notif local sin _id corresponde al mismo (type, resource) que una del
  // server, se considera la misma — el server gana porque tiene el _id real
  // y el count autoritativo.
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
    // Si el server ya tiene esta notif (por id o por resource), no la sobrescribimos:
    // el server es la fuente de verdad para `count`.
    if (byKey.has(idKey) || byKey.has(resKey)) return;
    claim(idKey, n);
    claim(resKey, n);
  });
  // Devolvemos cada notif una sola vez (el doble-indexado solo sirve para el
  // dedup; al deduplicar por id devolvemos solo las únicas).
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

const toastDedupKey = (t) => {
  if (t.tableId) return `${t.type}:t:${t.tableId}`;
  if (t.torneoId) return `${t.type}:r:${t.torneoId}`;
  if (t.compartidaId) return `${t.type}:c:${t.compartidaId}`;
  if (t.eventoId) return `${t.type}:e:${t.eventoId}`;
  if (t.fromUserId) return `${t.type}:u:${t.fromUserId}`;
  return t.type;
};

const pushToast = (prev, toast) => {
  const key = toastDedupKey(toast);
  const filtered = prev.filter((t) => toastDedupKey(t) !== key);
  const next = [...filtered, { id: makeToastId(), ...toast }];
  return next.length > 4 ? next.slice(-4) : next;
};

// Mapea eventos socket → sección controlada. Permite filtrar al receptor cuando un admin
// dispara una acción que el receptor (no-admin) no debería ver porque la sección está OFF.
const EVENT_SECTION = {
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
};

export function NotificationProvider({ children }) {
  const { user, refreshUser } = useAuth();
  const { applyServerConfig, isSectionEnabled } = useSiteConfig();
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const activeTableRef = useRef(null);
  const activeEventoRef = useRef(null);
  const adminChatActiveRef = useRef(false);
  const dmListenersRef = useRef(new Set());
  const friendListenersRef = useRef(new Set());
  const sectionCheckRef = useRef(isSectionEnabled);
  useEffect(() => {
    sectionCheckRef.current = isSectionEnabled;
  }, [isSectionEnabled]);

  // Wrap a socket handler with a section-enabled check. If the section is OFF for the
  // current user (and they're not admin), drop the event silently (defense-in-depth).
  const gated = (event, handler) => (payload) => {
    const section = EVENT_SECTION[event];
    if (section && !sectionCheckRef.current(section)) return;
    handler(payload);
  };

  // Load from server when user is available; reset entirely on logout
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setToasts([]);
      return;
    }
    let cancelled = false;
    axios
      .get("/api/notifications")
      .then(({ data }) => {
        if (cancelled) return;
        // Merge with any local state arrived via socket while the GET was in-flight
        setNotifications((local) => mergeNotifs(data, local));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("token");
    const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on(
      "chat:notification",
      gated("chat:notification", (notif) => {
        if (activeTableRef.current === notif.tableId) return;

        setNotifications((prev) => {
          const existing = findExisting(prev, "chat", notif.tableId);
          if (existing) {
            return prev.map((n) =>
              (n.type ?? "chat") === "chat" && n.tableId === notif.tableId
                ? {
                    ...n,
                    _id: notif.notifId || n._id,
                    notifId: notif.notifId || n.notifId,
                    read: false,
                    count: notif.count,
                    lastSenderUsername: notif.senderUsername,
                    lastMessagePreview: notif.messagePreview,
                    timestamp: notif.timestamp,
                  }
                : n,
            );
          }
          return [
            ...prev,
            {
              _id: notif.notifId,
              notifId: notif.notifId,
              type: "chat",
              tableId: notif.tableId,
              tableName: notif.tableName,
              count: notif.count,
              read: false,
              lastSenderUsername: notif.senderUsername,
              lastMessagePreview: notif.messagePreview,
              timestamp: notif.timestamp,
            },
          ];
        });

        setToasts((prev) =>
          pushToast(prev, {
            type: "chat",
            tableId: notif.tableId,
            tableName: notif.tableName,
            senderUsername: notif.senderUsername,
            messagePreview: notif.messagePreview,
          }),
        );
      }),
    );

    socket.on(
      "join:accepted",
      gated("join:accepted", (notif) => {
        if (activeTableRef.current === notif.tableId) return;

        setNotifications((prev) => {
          const rest = prev.filter(
            (n) => !(n.type === "join_accepted" && n.tableId === notif.tableId),
          );
          return [
            ...rest,
            {
              type: "join_accepted",
              tableId: notif.tableId,
              tableName: notif.tableName,
              count: 1,
              read: false,
              timestamp: notif.timestamp,
            },
          ];
        });

        setToasts((prev) =>
          pushToast(prev, {
            type: "join_accepted",
            tableId: notif.tableId,
            tableName: notif.tableName,
          }),
        );
      }),
    );

    socket.on(
      "table:comment",
      gated("table:comment", (notif) => {
        if (activeTableRef.current === notif.tableId) return;

        setNotifications((prev) => {
          const existing = findExisting(prev, "comment", notif.tableId);
          if (existing) {
            return prev.map((n) =>
              n.type === "comment" && n.tableId === notif.tableId
                ? {
                    ...n,
                    _id: notif.notifId || n._id,
                    notifId: notif.notifId || n.notifId,
                    read: false,
                    count: notif.count,
                    lastCommenterUsername: notif.commenterUsername,
                    lastCommentPreview: notif.commentPreview,
                    timestamp: notif.timestamp,
                  }
                : n,
            );
          }
          return [
            ...prev,
            {
              _id: notif.notifId,
              notifId: notif.notifId,
              type: "comment",
              tableId: notif.tableId,
              tableName: notif.tableName,
              count: notif.count,
              read: false,
              lastCommenterUsername: notif.commenterUsername,
              lastCommentPreview: notif.commentPreview,
              timestamp: notif.timestamp,
            },
          ];
        });

        setToasts((prev) =>
          pushToast(prev, {
            type: "comment",
            tableId: notif.tableId,
            tableName: notif.tableName,
            commenterUsername: notif.commenterUsername,
            commentPreview: notif.commentPreview,
          }),
        );
      }),
    );

    socket.on(
      "table:image",
      gated("table:image", (notif) => {
        if (activeTableRef.current === notif.tableId) return;

        setNotifications((prev) => {
          const existing = findExisting(prev, "image", notif.tableId);
          if (existing) {
            return prev.map((n) =>
              n.type === "image" && n.tableId === notif.tableId
                ? {
                    ...n,
                    _id: notif.notifId || n._id,
                    notifId: notif.notifId || n.notifId,
                    read: false,
                    count: notif.count,
                    lastUploaderUsername: notif.uploaderUsername,
                    timestamp: notif.timestamp,
                  }
                : n,
            );
          }
          return [
            ...prev,
            {
              _id: notif.notifId,
              notifId: notif.notifId,
              type: "image",
              tableId: notif.tableId,
              tableName: notif.tableName,
              count: notif.count,
              read: false,
              lastUploaderUsername: notif.uploaderUsername,
              timestamp: notif.timestamp,
            },
          ];
        });

        setToasts((prev) =>
          pushToast(prev, {
            type: "image",
            tableId: notif.tableId,
            tableName: notif.tableName,
            uploaderUsername: notif.uploaderUsername,
          }),
        );
      }),
    );

    socket.on(
      "table:spot-opened",
      gated("table:spot-opened", (notif) => {
        if (activeTableRef.current === notif.tableId) return;

        setNotifications((prev) => {
          const rest = prev.filter(
            (n) => !(n.type === "spot_opened" && n.tableId === notif.tableId),
          );
          return [
            ...rest,
            {
              type: "spot_opened",
              tableId: notif.tableId,
              tableName: notif.tableName,
              count: 1,
              read: false,
              timestamp: notif.timestamp,
            },
          ];
        });

        setToasts((prev) =>
          pushToast(prev, {
            type: "spot_opened",
            tableId: notif.tableId,
            tableName: notif.tableName,
          }),
        );
      }),
    );

    socket.on(
      "join:request",
      gated("join:request", (notif) => {
        if (activeTableRef.current === notif.tableId) return;

        setNotifications((prev) => {
          const existing = findExisting(prev, "join_request", notif.tableId);
          if (existing) {
            return prev.map((n) =>
              n.type === "join_request" && n.tableId === notif.tableId
                ? {
                    ...n,
                    _id: notif.notifId || n._id,
                    notifId: notif.notifId || n.notifId,
                    read: false,
                    count: notif.count,
                    lastRequesterUsername: notif.requesterUsername,
                    timestamp: notif.timestamp,
                  }
                : n,
            );
          }
          return [
            ...prev,
            {
              _id: notif.notifId,
              notifId: notif.notifId,
              type: "join_request",
              tableId: notif.tableId,
              tableName: notif.tableName,
              count: notif.count,
              read: false,
              lastRequesterUsername: notif.requesterUsername,
              timestamp: notif.timestamp,
            },
          ];
        });

        setToasts((prev) =>
          pushToast(prev, {
            type: "join_request",
            tableId: notif.tableId,
            tableName: notif.tableName,
            requesterUsername: notif.requesterUsername,
          }),
        );
      }),
    );

    socket.on(
      "friend:request",
      gated("friend:request", (notif) => {
        setNotifications((prev) => {
          const existing = prev.find(
            (n) =>
              n.type === "friend_request" && n.fromUserId === notif.fromUserId,
          );
          if (existing) return prev;
          return [
            ...prev,
            {
              type: "friend_request",
              fromUserId: notif.fromUserId,
              fromUsername: notif.fromUsername,
              count: 1,
              read: false,
              timestamp: new Date().toISOString(),
            },
          ];
        });
        setToasts((prev) =>
          pushToast(prev, {
            type: "friend_request",
            fromUserId: notif.fromUserId,
            fromUsername: notif.fromUsername,
          }),
        );
      }),
    );

    socket.on(
      "friend:accepted",
      gated("friend:accepted", (notif) => {
        setNotifications((prev) => {
          const existing = prev.find(
            (n) =>
              n.type === "friend_accepted" && n.fromUserId === notif.fromUserId,
          );
          if (existing) return prev;
          return [
            ...prev,
            {
              type: "friend_accepted",
              fromUserId: notif.fromUserId,
              fromUsername: notif.fromUsername,
              count: 1,
              read: false,
              timestamp: new Date().toISOString(),
            },
          ];
        });
        setToasts((prev) =>
          pushToast(prev, {
            type: "friend_accepted",
            fromUserId: notif.fromUserId,
            fromUsername: notif.fromUsername,
          }),
        );
        refreshUser().catch(() => {});
        friendListenersRef.current.forEach((fn) => fn());
      }),
    );

    socket.on(
      "dm:message",
      gated("dm:message", (msg) => {
        const fromId = (msg.from?._id || msg.from || "").toString();
        const fromUsername = msg.from?.username || "?";
        const preview = (msg.content || "").slice(0, 60);
        // count + notifId vienen en el payload (post-emitNotification).
        // Fallback a +1 / nuevo doc para resistir payloads viejos durante deploy.
        const incomingCount = typeof msg.count === "number" ? msg.count : null;
        const incomingNotifId = msg.notifId || null;

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
                    timestamp: msg.timestamp || new Date().toISOString(),
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
              timestamp: msg.timestamp || new Date().toISOString(),
            },
          ];
        });

        dmListenersRef.current.forEach((fn) => fn(msg));
      }),
    );

    socket.on("admin:message", (msg) => {
      const senderUsername = msg.from?.username || "?";
      const preview = (msg.content || "").slice(0, 60);
      const incomingCount = typeof msg.count === "number" ? msg.count : null;
      const incomingNotifId = msg.notifId || null;

      if (adminChatActiveRef.current) {
        // Already viewing admin chat: keep server notif in sync (marked read)
        axios.patch("/api/admin-chat/read").catch(() => {});
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
                  timestamp: msg.timestamp || new Date().toISOString(),
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
            count: incomingCount ?? 1,
            read: false,
            timestamp: msg.timestamp || new Date().toISOString(),
          },
        ];
      });
    });

    const handleTorneoEvent = (eventType) => (notif) => {
      setNotifications((prev) => {
        const rest = prev.filter(
          (n) => !(n.type === eventType && n.torneoId === notif.torneoId),
        );
        return [
          ...rest,
          {
            type: eventType,
            torneoId: notif.torneoId,
            torneoTitle: notif.torneoTitle,
            round: notif.round,
            isPhase: notif.isPhase || false,
            count: 1,
            read: false,
            timestamp: notif.timestamp || new Date().toISOString(),
          },
        ];
      });
      setToasts((prev) =>
        pushToast(prev, {
          type: eventType,
          torneoId: notif.torneoId,
          torneoTitle: notif.torneoTitle,
          round: notif.round,
          isPhase: notif.isPhase || false,
        }),
      );
    };

    socket.on(
      "torneo:registration-accepted",
      gated(
        "torneo:registration-accepted",
        handleTorneoEvent("tournament_accepted"),
      ),
    );
    socket.on(
      "torneo:registration-rejected",
      gated(
        "torneo:registration-rejected",
        handleTorneoEvent("tournament_rejected"),
      ),
    );
    socket.on(
      "torneo:advanced",
      gated("torneo:advanced", handleTorneoEvent("tournament_advanced")),
    );
    socket.on(
      "torneo:eliminated",
      gated("torneo:eliminated", handleTorneoEvent("tournament_eliminated")),
    );
    socket.on(
      "torneo:started",
      gated("torneo:started", handleTorneoEvent("tournament_started")),
    );
    socket.on(
      "torneo:finished",
      gated("torneo:finished", handleTorneoEvent("tournament_finished")),
    );

    socket.on(
      "compartida:comment",
      gated("compartida:comment", (notif) => {
        setNotifications((prev) => {
          const existing = prev.find(
            (n) =>
              n.type === "compartida_comment" &&
              n.compartidaId === notif.compartidaId,
          );
          if (existing) {
            return prev.map((n) =>
              n.type === "compartida_comment" &&
              n.compartidaId === notif.compartidaId
                ? {
                    ...n,
                    _id: notif.notifId || n._id,
                    notifId: notif.notifId || n.notifId,
                    read: false,
                    count: notif.count,
                    lastCommenterUsername: notif.commenterUsername,
                    lastCommentPreview: notif.commentPreview,
                    timestamp: notif.timestamp,
                  }
                : n,
            );
          }
          return [
            ...prev,
            {
              _id: notif.notifId,
              notifId: notif.notifId,
              type: "compartida_comment",
              compartidaId: notif.compartidaId,
              compartidaTitle: notif.compartidaTitle,
              count: notif.count,
              read: false,
              lastCommenterUsername: notif.commenterUsername,
              lastCommentPreview: notif.commentPreview,
              timestamp: notif.timestamp,
            },
          ];
        });
        setToasts((prev) =>
          pushToast(prev, {
            type: "compartida_comment",
            compartidaId: notif.compartidaId,
            compartidaTitle: notif.compartidaTitle,
            commenterUsername: notif.commenterUsername,
            commentPreview: notif.commentPreview,
          }),
        );
      }),
    );

    socket.on(
      "compartida:like",
      gated("compartida:like", (notif) => {
        setNotifications((prev) => {
          const existing = prev.find(
            (n) =>
              n.type === "compartida_like" &&
              n.compartidaId === notif.compartidaId,
          );
          if (existing) {
            return prev.map((n) =>
              n.type === "compartida_like" &&
              n.compartidaId === notif.compartidaId
                ? {
                    ...n,
                    _id: notif.notifId || n._id,
                    notifId: notif.notifId || n.notifId,
                    read: false,
                    count: notif.count,
                    lastSenderUsername: notif.fromUsername,
                    timestamp: notif.timestamp,
                  }
                : n,
            );
          }
          return [
            ...prev,
            {
              _id: notif.notifId,
              notifId: notif.notifId,
              type: "compartida_like",
              compartidaId: notif.compartidaId,
              compartidaTitle: notif.compartidaTitle,
              count: notif.count,
              read: false,
              lastSenderUsername: notif.fromUsername,
              timestamp: notif.timestamp,
            },
          ];
        });
        setToasts((prev) =>
          pushToast(prev, {
            type: "compartida_like",
            compartidaId: notif.compartidaId,
            compartidaTitle: notif.compartidaTitle,
            fromUsername: notif.fromUsername,
          }),
        );
      }),
    );

    socket.on(
      "table:cancelled",
      gated("table:cancelled", (notif) => {
        setNotifications((prev) => {
          const rest = prev.filter(
            (n) =>
              !(n.type === "table_cancelled" && n.tableId === notif.tableId),
          );
          return [
            ...rest,
            {
              type: "table_cancelled",
              tableId: notif.tableId,
              tableName: notif.tableName,
              count: 1,
              read: false,
              timestamp: notif.timestamp,
            },
          ];
        });
        setToasts((prev) =>
          pushToast(prev, {
            type: "table_cancelled",
            tableId: notif.tableId,
            tableName: notif.tableName,
          }),
        );
      }),
    );

    socket.on(
      "join:rejected",
      gated("join:rejected", (notif) => {
        setNotifications((prev) => {
          const rest = prev.filter(
            (n) => !(n.type === "join_rejected" && n.tableId === notif.tableId),
          );
          return [
            ...rest,
            {
              type: "join_rejected",
              tableId: notif.tableId,
              tableName: notif.tableName,
              count: 1,
              read: false,
              timestamp: notif.timestamp,
            },
          ];
        });
        setToasts((prev) =>
          pushToast(prev, {
            type: "join_rejected",
            tableId: notif.tableId,
            tableName: notif.tableName,
          }),
        );
      }),
    );

    socket.on(
      "noticia:published",
      gated("noticia:published", (notif) => {
        setToasts((prev) =>
          pushToast(prev, {
            type: "noticia",
            noticiaId: notif.noticiaId,
            title: notif.title,
          }),
        );
      }),
    );

    // ── Eventos ───────────────────────────────────────────────────────
    // Único listener para los 5 tipos. El payload trae `type` que mapea 1-a-1
    // a un enum de Notification ('evento_confirmed', 'evento_rejected', etc.).
    // Lo convertimos a "type" interno para mantener el shape de los demás.
    const EVENTO_TYPE_MAP = {
      confirmed: "evento_confirmed",
      rejected: "evento_rejected",
      cancelled: "evento_cancelled",
      updated: "evento_updated",
      reminder: "evento_reminder",
    };
    socket.on(
      "evento:notification",
      gated("evento:notification", (payload) => {
        // El server emite con `type` short ("confirmed") o ya largo ("evento_confirmed")
        // — soportamos ambos para resistir cambios futuros del payload.
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
        };
        setNotifications((prev) => {
          const rest = prev.filter(
            (n) => !(n.type === notifType && n.eventoId === common.eventoId),
          );
          return [
            ...rest,
            {
              ...common,
              count: 1,
              read: false,
              timestamp: new Date().toISOString(),
            },
          ];
        });
        // Si el user está viendo el detalle del evento, no toasteamos
        // — el evento ya está visible en pantalla (mismo patrón que mesas).
        // La notif persistente igual se guarda y se marca leída por
        // setActiveEvento → markReadEvento (efecto de B1).
        if (activeEventoRef.current === common.eventoId) return;
        setToasts((prev) => pushToast(prev, common));
      }),
    );

    socket.on("site-config:updated", (config) => {
      applyServerConfig(config);
    });

    return () => socket.disconnect();
    // refreshUser is intentionally omitted — including it would reconnect the socket on every render
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper: resetea `count` a 0 al marcar leído. Sin esto los counters de
  // tipos agregables crecen monótonamente entre sesiones — el bug de "doble
  // conteo" percibido por el usuario. El próximo evento llega con count
  // absoluto desde el server (post-emitNotification) y restaura el valor real.
  const resetRead = (n) => ({ ...n, read: true, count: 0 });

  const markRead = useCallback((tableId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.tableId === tableId ? resetRead(n) : n)),
    );
    axios.patch("/api/notifications/read", { tableId }).catch(() => {});
  }, []);

  const markReadFriend = useCallback((fromUserId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.fromUserId === fromUserId ? resetRead(n) : n)),
    );
    axios.patch("/api/notifications/read", { fromUserId }).catch(() => {});
  }, []);

  const markReadTorneo = useCallback((torneoId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.torneoId === torneoId ? resetRead(n) : n)),
    );
    axios.patch("/api/notifications/read", { torneoId }).catch(() => {});
  }, []);

  const markReadCompartida = useCallback((compartidaId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.compartidaId === compartidaId ? resetRead(n) : n)),
    );
    axios.patch("/api/notifications/read", { compartidaId }).catch(() => {});
  }, []);

  const markReadEvento = useCallback((eventoId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.eventoId === eventoId ? resetRead(n) : n)),
    );
    axios.patch("/api/notifications/read", { eventoId }).catch(() => {});
  }, []);

  const markReadDm = useCallback((fromUserId) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.type === "dm" && n.fromUserId === fromUserId ? resetRead(n) : n,
      ),
    );
  }, []);

  const markReadAdminChat = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => (n.type === "admin_chat" ? resetRead(n) : n)),
    );
    axios.patch("/api/admin-chat/read").catch(() => {});
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    axios.delete("/api/notifications").catch(() => {});
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    axios.patch("/api/notifications/read", {}).catch(() => {});
  }, []);

  const loadOlder = useCallback(async () => {
    const oldest = notifications.reduce((min, n) => {
      const t = new Date(n.updatedAt || n.timestamp || 0).getTime();
      return min == null || t < min ? t : min;
    }, null);
    if (oldest == null) return { count: 0 };
    try {
      const { data } = await axios.get("/api/notifications", {
        params: { before: new Date(oldest).toISOString(), limit: 20 },
      });
      setNotifications((prev) => mergeNotifs(prev, data));
      return { count: data.length };
    } catch {
      return { count: 0 };
    }
  }, [notifications]);

  const setActiveTable = useCallback(
    (tableId) => {
      activeTableRef.current = tableId;
      if (tableId) markRead(tableId);
    },
    [markRead],
  );

  const setActiveTorneo = useCallback(
    (torneoId) => {
      if (torneoId) markReadTorneo(torneoId);
    },
    [markReadTorneo],
  );

  const setActiveCompartida = useCallback(
    (compartidaId) => {
      if (compartidaId) markReadCompartida(compartidaId);
    },
    [markReadCompartida],
  );

  const setActiveEvento = useCallback(
    (eventoId) => {
      activeEventoRef.current = eventoId;
      if (eventoId) markReadEvento(eventoId);
    },
    [markReadEvento],
  );

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast) => {
    setToasts((prev) => pushToast(prev, toast));
  }, []);

  const addDmListener = useCallback((fn) => {
    dmListenersRef.current.add(fn);
    return () => dmListenersRef.current.delete(fn);
  }, []);

  const addFriendListener = useCallback((fn) => {
    friendListenersRef.current.add(fn);
    return () => friendListenersRef.current.delete(fn);
  }, []);

  const notifyFriendAdded = useCallback(() => {
    friendListenersRef.current.forEach((fn) => fn());
  }, []);

  const setAdminChatActive = useCallback(
    (active) => {
      adminChatActiveRef.current = active;
      if (active) markReadAdminChat();
    },
    [markReadAdminChat],
  );

  const adminChatUnread = notifications
    .filter((n) => n.type === "admin_chat" && !n.read)
    .reduce((sum, n) => sum + (n.count || 1), 0);

  // DM badge — fuente única de verdad. ChatContext lo re-exporta tal cual para
  // los consumidores existentes (Navbar, ChatLauncher). Antes ChatContext
  // mantenía un counter paralelo (suma de conv.unread) que se desincronizaba
  // del listado de /notificaciones.
  const dmUnreadTotal = notifications
    .filter((n) => n.type === "dm" && !n.read)
    .reduce((sum, n) => sum + (n.count || 1), 0);

  // Bell badge: exclude dm and admin_chat (they have their own badges on the chat icons)
  const totalUnread = notifications
    .filter((n) => !n.read && n.type !== "dm" && n.type !== "admin_chat")
    .reduce((sum, n) => sum + (n.count || 1), 0);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount: totalUnread,
        dmUnreadTotal,
        markRead,
        markReadFriend,
        markReadTorneo,
        markReadCompartida,
        markReadEvento,
        markReadDm,
        markReadAdminChat,
        markAllRead,
        loadOlder,
        clearAll,
        setActiveTable,
        setActiveTorneo,
        setActiveCompartida,
        setActiveEvento,
        toasts,
        dismissToast,
        addToast,
        addDmListener,
        addFriendListener,
        notifyFriendAdded,
        adminChatUnread,
        setAdminChatActive,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error(
      "useNotifications must be used within NotificationProvider",
    );
  return ctx;
}
