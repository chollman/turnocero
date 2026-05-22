import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { io } from "socket.io-client";
import axios from "axios";
import { useAuth } from "./AuthContext";
import { useSiteConfig } from "./SiteConfigContext";
import {
  EVENT_SECTION,
  mergeNotifs,
  pushToast,
  markReadByPredicate,
  applyChatNotif,
  applyCommentNotif,
  applyImageNotif,
  applyJoinRequestNotif,
  applyJoinAcceptedNotif,
  applyJoinRejectedNotif,
  applySpotOpenedNotif,
  applyTableCancelledNotif,
  applyFriendRequestNotif,
  applyFriendAcceptedNotif,
  applyDmMessageNotif,
  applyAdminMessageNotif,
  applyTorneoNotif,
  applyCompartidaCommentNotif,
  applyCompartidaLikeNotif,
  applyNoticiaPublishedNotif,
  applyEventoNotif,
} from "./notificationReducers";

const NotificationContext = createContext(null);

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

  // Wrap a socket handler with a section-enabled check. If the section is OFF
  // for the current user (and they're not admin), drop the event silently
  // (defense-in-depth — el server no debería emitir pero el filtro extra
  // evita bugs).
  const gated = (event, handler) => (payload) => {
    const section = EVENT_SECTION[event];
    if (section && !sectionCheckRef.current(section)) return;
    handler(payload);
  };

  // Load from server when user is available; reset entirely on logout.
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
        // Merge with any local state arrived via socket while the GET was in-flight.
        setNotifications((local) => mergeNotifs(data, local));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Socket lifecycle + listeners. La lógica de cada listener vive en
  // `notificationReducers.js` — acá solo conectamos el socket, hacemos los
  // checks de "active resource" (notif suprimida cuando el user ya está
  // viendo el recurso), y delegamos.
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("token");
    const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket"],
    });

    // ── Mesas / Tables ──
    socket.on(
      "chat:notification",
      gated("chat:notification", (payload) => {
        if (activeTableRef.current === payload.tableId) return;
        applyChatNotif({ setNotifications, setToasts, payload });
      }),
    );
    socket.on(
      "table:comment",
      gated("table:comment", (payload) => {
        if (activeTableRef.current === payload.tableId) return;
        applyCommentNotif({ setNotifications, setToasts, payload });
      }),
    );
    socket.on(
      "table:image",
      gated("table:image", (payload) => {
        if (activeTableRef.current === payload.tableId) return;
        applyImageNotif({ setNotifications, setToasts, payload });
      }),
    );
    socket.on(
      "join:request",
      gated("join:request", (payload) => {
        if (activeTableRef.current === payload.tableId) return;
        applyJoinRequestNotif({ setNotifications, setToasts, payload });
      }),
    );
    socket.on(
      "join:accepted",
      gated("join:accepted", (payload) => {
        if (activeTableRef.current === payload.tableId) return;
        applyJoinAcceptedNotif({ setNotifications, setToasts, payload });
      }),
    );
    socket.on(
      "join:rejected",
      gated("join:rejected", (payload) =>
        applyJoinRejectedNotif({ setNotifications, setToasts, payload }),
      ),
    );
    socket.on(
      "table:spot-opened",
      gated("table:spot-opened", (payload) => {
        if (activeTableRef.current === payload.tableId) return;
        applySpotOpenedNotif({ setNotifications, setToasts, payload });
      }),
    );
    socket.on(
      "table:cancelled",
      gated("table:cancelled", (payload) =>
        applyTableCancelledNotif({ setNotifications, setToasts, payload }),
      ),
    );

    // ── Friends ──
    socket.on(
      "friend:request",
      gated("friend:request", (payload) =>
        applyFriendRequestNotif({ setNotifications, setToasts, payload }),
      ),
    );
    socket.on(
      "friend:accepted",
      gated("friend:accepted", (payload) =>
        applyFriendAcceptedNotif({
          setNotifications,
          setToasts,
          payload,
          onAccepted: () => {
            refreshUser().catch(() => {});
            friendListenersRef.current.forEach((fn) => fn());
          },
        }),
      ),
    );

    // ── DM ──
    socket.on(
      "dm:message",
      gated("dm:message", (payload) =>
        applyDmMessageNotif({
          setNotifications,
          payload,
          onMessage: (msg) =>
            dmListenersRef.current.forEach((fn) => fn(msg)),
        }),
      ),
    );

    // ── Admin chat ──
    socket.on("admin:message", (payload) =>
      applyAdminMessageNotif({
        setNotifications,
        payload,
        isActive: () => adminChatActiveRef.current,
      }),
    );

    // ── Torneos ── (6 tipos parametrizados con el mismo reducer)
    const dispatchTorneo = (type) => (payload) =>
      applyTorneoNotif({ setNotifications, setToasts, payload, type });
    socket.on(
      "torneo:registration-accepted",
      gated(
        "torneo:registration-accepted",
        dispatchTorneo("tournament_accepted"),
      ),
    );
    socket.on(
      "torneo:registration-rejected",
      gated(
        "torneo:registration-rejected",
        dispatchTorneo("tournament_rejected"),
      ),
    );
    socket.on(
      "torneo:advanced",
      gated("torneo:advanced", dispatchTorneo("tournament_advanced")),
    );
    socket.on(
      "torneo:eliminated",
      gated("torneo:eliminated", dispatchTorneo("tournament_eliminated")),
    );
    socket.on(
      "torneo:started",
      gated("torneo:started", dispatchTorneo("tournament_started")),
    );
    socket.on(
      "torneo:finished",
      gated("torneo:finished", dispatchTorneo("tournament_finished")),
    );

    // ── Compartidas ──
    socket.on(
      "compartida:comment",
      gated("compartida:comment", (payload) =>
        applyCompartidaCommentNotif({ setNotifications, setToasts, payload }),
      ),
    );
    socket.on(
      "compartida:like",
      gated("compartida:like", (payload) =>
        applyCompartidaLikeNotif({ setNotifications, setToasts, payload }),
      ),
    );

    // ── Noticias ──
    socket.on(
      "noticia:published",
      gated("noticia:published", (payload) =>
        applyNoticiaPublishedNotif({ setToasts, payload }),
      ),
    );

    // ── Eventos ── (7 tipos en un solo evento socket — el type viene en payload)
    socket.on(
      "evento:notification",
      gated("evento:notification", (payload) =>
        applyEventoNotif({
          setNotifications,
          setToasts,
          payload,
          isActive: (eventoId) => activeEventoRef.current === eventoId,
        }),
      ),
    );

    // ── Site config ──
    socket.on("site-config:updated", (config) => {
      applyServerConfig(config);
    });

    return () => socket.disconnect();
    // refreshUser is intentionally omitted — including it would reconnect the
    // socket on every render.
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── markRead helpers ────────────────────────────────────────────────
  // Cada uno setea read: true + count: 0 en las notifs que matchean el
  // predicate. El reset de count es crítico — sin él los counters
  // aggregating crecen monótonamente entre sesiones (memory:
  // notifications-contract).

  const markRead = useCallback((tableId) => {
    setNotifications((prev) =>
      markReadByPredicate(prev, (n) => n.tableId === tableId),
    );
    axios.patch("/api/notifications/read", { tableId }).catch(() => {});
  }, []);

  const markReadFriend = useCallback((fromUserId) => {
    setNotifications((prev) =>
      markReadByPredicate(prev, (n) => n.fromUserId === fromUserId),
    );
    axios.patch("/api/notifications/read", { fromUserId }).catch(() => {});
  }, []);

  const markReadTorneo = useCallback((torneoId) => {
    setNotifications((prev) =>
      markReadByPredicate(prev, (n) => n.torneoId === torneoId),
    );
    axios.patch("/api/notifications/read", { torneoId }).catch(() => {});
  }, []);

  const markReadCompartida = useCallback((compartidaId) => {
    setNotifications((prev) =>
      markReadByPredicate(prev, (n) => n.compartidaId === compartidaId),
    );
    axios.patch("/api/notifications/read", { compartidaId }).catch(() => {});
  }, []);

  const markReadEvento = useCallback((eventoId) => {
    setNotifications((prev) =>
      markReadByPredicate(prev, (n) => n.eventoId === eventoId),
    );
    axios.patch("/api/notifications/read", { eventoId }).catch(() => {});
  }, []);

  const markReadDm = useCallback((fromUserId) => {
    setNotifications((prev) =>
      markReadByPredicate(
        prev,
        (n) => n.type === "dm" && n.fromUserId === fromUserId,
      ),
    );
  }, []);

  const markReadAdminChat = useCallback(() => {
    setNotifications((prev) =>
      markReadByPredicate(prev, (n) => n.type === "admin_chat"),
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

  // ── Active resource tracking ─────────────────────────────────────────
  // Cuando el user abre la pantalla de un recurso, dejamos de notificar
  // sobre ese recurso específico (la info está visible en pantalla). Al
  // cerrar la pantalla, el `setActiveX(null)` reactiva las notifs.

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

  // ── Toasts ────────────────────────────────────────────────────────────

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast) => {
    setToasts((prev) => pushToast(prev, toast));
  }, []);

  // ── Listener registration (DM + friend cross-context hooks) ──────────

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

  // ── Computed badges ──────────────────────────────────────────────────

  const adminChatUnread = notifications
    .filter((n) => n.type === "admin_chat" && !n.read)
    .reduce((sum, n) => sum + (n.count || 1), 0);

  // DM badge — fuente única de verdad. ChatContext lo re-exporta tal cual
  // para los consumidores existentes (Navbar, ChatLauncher). Antes
  // ChatContext mantenía un counter paralelo (suma de conv.unread) que se
  // desincronizaba del listado de /notificaciones.
  const dmUnreadTotal = notifications
    .filter((n) => n.type === "dm" && !n.read)
    .reduce((sum, n) => sum + (n.count || 1), 0);

  // Bell badge: excluye dm y admin_chat (tienen sus propios badges en los
  // íconos de chat).
  const totalUnread = useMemo(
    () =>
      notifications
        .filter((n) => !n.read && n.type !== "dm" && n.type !== "admin_chat")
        .reduce((sum, n) => sum + (n.count || 1), 0),
    [notifications],
  );

  const value = useMemo(
    () => ({
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
    }),
    [
      notifications,
      totalUnread,
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
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
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
