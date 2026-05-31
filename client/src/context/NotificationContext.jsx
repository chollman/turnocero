import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";
import { useSiteConfig } from "./SiteConfigContext";
import { API } from "../api/endpoints";
import {
  EVENT_SECTION,
  mergeNotifs,
  pushToast,
  markReadByPredicate,
} from "./notificationReducers";
import { useNotificationSocket } from "./notificationListeners/useNotificationSocket";
import { useTableNotificationListeners } from "./notificationListeners/useTableNotificationListeners";
import { useFriendNotificationListeners } from "./notificationListeners/useFriendNotificationListeners";
import { useDmNotificationListeners } from "./notificationListeners/useDmNotificationListeners";
import { useAdminChatNotificationListeners } from "./notificationListeners/useAdminChatNotificationListeners";
import { useTorneoNotificationListeners } from "./notificationListeners/useTorneoNotificationListeners";
import { useCompartidaNotificationListeners } from "./notificationListeners/useCompartidaNotificationListeners";
import { useNoticiaNotificationListeners } from "./notificationListeners/useNoticiaNotificationListeners";
import { useEventoNotificationListeners } from "./notificationListeners/useEventoNotificationListeners";
import { useSiteConfigSocketListener } from "./notificationListeners/useSiteConfigSocketListener";

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

  // Wrap un socket handler con check de section-enabled. Si la sección
  // está OFF para el user, droppea silenciosamente (defense-in-depth — el
  // server no debería emitir pero el filtro extra evita bugs). Memoizado
  // con useCallback para que los useEffects de los hooks de listeners no
  // re-corran innecesariamente.
  const gated = useCallback(
    (event, handler) => (payload) => {
      const section = EVENT_SECTION[event];
      if (section && !sectionCheckRef.current(section)) return;
      handler(payload);
    },
    [],
  );

  // Load from server when user is available; reset entirely on logout.
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setToasts([]);
      return;
    }
    let cancelled = false;
    axios
      .get(API.notifications.LIST)
      .then(({ data }) => {
        if (cancelled) return;
        // Merge con local state que llegó via socket mientras el GET estaba in-flight.
        setNotifications((local) => mergeNotifs(data, local));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  // ── Socket + listeners por dominio ──────────────────────────────────
  // useNotificationSocket maneja lifecycle (connect/disconnect on user).
  // Cada hook de listeners attachea los socket.on(...) de su dominio y
  // limpia con socket.off(...) al cleanup. La lógica de cada reducer vive
  // en `notificationReducers.js`. Esto reemplazó al useEffect monolítico
  // de ~190 líneas con 25+ listeners en línea (tech-debt P1.1).
  const socket = useNotificationSocket(user);

  useTableNotificationListeners({
    socket,
    gated,
    activeTableRef,
    setNotifications,
    setToasts,
  });
  useFriendNotificationListeners({
    socket,
    gated,
    setNotifications,
    setToasts,
    refreshUser,
    friendListenersRef,
  });
  useDmNotificationListeners({
    socket,
    gated,
    setNotifications,
    dmListenersRef,
  });
  useAdminChatNotificationListeners({
    socket,
    setNotifications,
    adminChatActiveRef,
  });
  useTorneoNotificationListeners({
    socket,
    gated,
    setNotifications,
    setToasts,
  });
  useCompartidaNotificationListeners({
    socket,
    gated,
    setNotifications,
    setToasts,
  });
  useNoticiaNotificationListeners({ socket, gated, setToasts });
  useEventoNotificationListeners({
    socket,
    gated,
    activeEventoRef,
    setNotifications,
    setToasts,
  });
  useSiteConfigSocketListener({ socket, applyServerConfig });

  // ── markRead helpers ────────────────────────────────────────────────
  // Cada uno setea read: true + count: 0 en las notifs que matchean el
  // predicate. El reset de count es crítico — sin él los counters
  // aggregating crecen monótonamente entre sesiones (memory:
  // notifications-contract).

  const markRead = useCallback((tableId) => {
    setNotifications((prev) =>
      markReadByPredicate(prev, (n) => n.tableId === tableId),
    );
    axios.patch(API.notifications.READ, { tableId }).catch(() => {});
  }, []);

  const markReadFriend = useCallback((fromUserId) => {
    setNotifications((prev) =>
      markReadByPredicate(prev, (n) => n.fromUserId === fromUserId),
    );
    axios.patch(API.notifications.READ, { fromUserId }).catch(() => {});
  }, []);

  const markReadTorneo = useCallback((torneoId) => {
    setNotifications((prev) =>
      markReadByPredicate(prev, (n) => n.torneoId === torneoId),
    );
    axios.patch(API.notifications.READ, { torneoId }).catch(() => {});
  }, []);

  const markReadCompartida = useCallback((compartidaId) => {
    setNotifications((prev) =>
      markReadByPredicate(prev, (n) => n.compartidaId === compartidaId),
    );
    axios.patch(API.notifications.READ, { compartidaId }).catch(() => {});
  }, []);

  const markReadEvento = useCallback((eventoId) => {
    setNotifications((prev) =>
      markReadByPredicate(prev, (n) => n.eventoId === eventoId),
    );
    axios.patch(API.notifications.READ, { eventoId }).catch(() => {});
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
    axios.patch(API.adminChat.READ).catch(() => {});
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    axios.delete(API.notifications.CLEAR).catch(() => {});
  }, []);

  // Descartar una notif puntual (botón X de cada fila). Optimista: la saca
  // del listado y dispara el DELETE; si el server falla, la restaura y avisa
  // por toast (feedback_errors_as_toasts).
  const dismiss = useCallback((notifId) => {
    if (!notifId) return;
    let removed = null;
    setNotifications((prev) => {
      const match = (n) => (n.notifId || n._id) === notifId;
      removed = prev.find(match) || null;
      return prev.filter((n) => !match(n));
    });
    axios.delete(API.notifications.DISMISS(notifId)).catch(() => {
      if (removed) setNotifications((prev) => mergeNotifs(prev, [removed]));
      setToasts((prev) =>
        pushToast(prev, {
          type: "error",
          message: "No pudimos descartar la notificación. Intentá de nuevo.",
        }),
      );
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    axios.patch(API.notifications.READ, {}).catch(() => {});
  }, []);

  const loadOlder = useCallback(async () => {
    const oldest = notifications.reduce((min, n) => {
      const t = new Date(n.updatedAt || n.timestamp || 0).getTime();
      return min == null || t < min ? t : min;
    }, null);
    if (oldest == null) return { count: 0 };
    try {
      const { data } = await axios.get(API.notifications.LIST, {
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
      dismiss,
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
      dismiss,
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
