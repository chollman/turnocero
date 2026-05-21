import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { useSiteConfig } from './SiteConfigContext';

const NotificationContext = createContext(null);
const makeToastId = () => `${Date.now()}-${Math.random()}`;

const findExisting = (prev, type, tableId) =>
  prev.find((n) => (n.type ?? 'chat') === type && n.tableId === tableId);

const notifKey = (n) => {
  const type = n.type ?? 'chat';
  if (n.tableId)      return `${type}:t:${n.tableId}`;
  if (n.torneoId)     return `${type}:r:${n.torneoId}`;
  if (n.compartidaId) return `${type}:c:${n.compartidaId}`;
  if (n.eventoId)     return `${type}:e:${n.eventoId}`;
  if (n.fromUserId)   return `${type}:u:${n.fromUserId}`;
  return type;
};

const mergeNotifs = (serverList, localList) => {
  const byKey = new Map();
  serverList.forEach((n) => byKey.set(notifKey(n), n));
  localList.forEach((n) => {
    const k = notifKey(n);
    const existing = byKey.get(k);
    const localTime = new Date(n.updatedAt || n.timestamp || 0).getTime();
    const serverTime = existing ? new Date(existing.updatedAt || existing.timestamp || 0).getTime() : 0;
    if (!existing || localTime > serverTime) byKey.set(k, n);
  });
  return Array.from(byKey.values());
};

const toastDedupKey = (t) => {
  if (t.tableId)      return `${t.type}:t:${t.tableId}`;
  if (t.torneoId)     return `${t.type}:r:${t.torneoId}`;
  if (t.compartidaId) return `${t.type}:c:${t.compartidaId}`;
  if (t.eventoId)     return `${t.type}:e:${t.eventoId}`;
  if (t.fromUserId)   return `${t.type}:u:${t.fromUserId}`;
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
  'chat:notification': 'mesas',
  'join:request':      'mesas',
  'join:accepted':     'mesas',
  'join:rejected':     'mesas',
  'table:comment':     'mesas',
  'table:image':       'mesas',
  'table:spot-opened': 'mesas',
  'table:cancelled':   'mesas',
  'friend:request':    'amigos',
  'friend:accepted':   'amigos',
  'dm:message':        'dms',
  'torneo:registration-accepted': 'torneos',
  'torneo:registration-rejected': 'torneos',
  'torneo:advanced':              'torneos',
  'torneo:eliminated':            'torneos',
  'torneo:started':               'torneos',
  'torneo:finished':              'torneos',
  'compartida:comment': 'compartidas',
  'compartida:like':    'compartidas',
  'noticia:published':  'noticias',
  'evento:notification': 'eventos',
};

export function NotificationProvider({ children }) {
  const { user, refreshUser } = useAuth();
  const { applyServerConfig, isSectionEnabled } = useSiteConfig();
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const activeTableRef = useRef(null);
  const adminChatActiveRef = useRef(false);
  const dmListenersRef = useRef(new Set());
  const friendListenersRef = useRef(new Set());
  const sectionCheckRef = useRef(isSectionEnabled);
  useEffect(() => { sectionCheckRef.current = isSectionEnabled; }, [isSectionEnabled]);

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
    axios.get('/api/notifications')
      .then(({ data }) => {
        if (cancelled) return;
        // Merge with any local state arrived via socket while the GET was in-flight
        setNotifications((local) => mergeNotifs(data, local));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const socket = io(socketUrl, { auth: { token }, transports: ['websocket'] });

    socket.on('chat:notification', gated('chat:notification', (notif) => {
      if (activeTableRef.current === notif.tableId) return;

      setNotifications((prev) => {
        const existing = findExisting(prev, 'chat', notif.tableId);
        if (existing) {
          return prev.map((n) =>
            (n.type ?? 'chat') === 'chat' && n.tableId === notif.tableId
              ? { ...n, read: false, count: n.count + 1, lastSenderUsername: notif.senderUsername, lastMessagePreview: notif.messagePreview, timestamp: notif.timestamp }
              : n
          );
        }
        return [...prev, { type: 'chat', tableId: notif.tableId, tableName: notif.tableName, count: 1, read: false, lastSenderUsername: notif.senderUsername, lastMessagePreview: notif.messagePreview, timestamp: notif.timestamp }];
      });

      setToasts((prev) => pushToast(prev, { type: 'chat', tableId: notif.tableId, tableName: notif.tableName, senderUsername: notif.senderUsername, messagePreview: notif.messagePreview }));
    }));

    socket.on('join:accepted', gated('join:accepted', (notif) => {
      if (activeTableRef.current === notif.tableId) return;

      setNotifications((prev) => {
        const rest = prev.filter((n) => !(n.type === 'join_accepted' && n.tableId === notif.tableId));
        return [...rest, { type: 'join_accepted', tableId: notif.tableId, tableName: notif.tableName, count: 1, read: false, timestamp: notif.timestamp }];
      });

      setToasts((prev) => pushToast(prev, { type: 'join_accepted', tableId: notif.tableId, tableName: notif.tableName }));
    }));

    socket.on('table:comment', gated('table:comment', (notif) => {
      if (activeTableRef.current === notif.tableId) return;

      setNotifications((prev) => {
        const existing = findExisting(prev, 'comment', notif.tableId);
        if (existing) {
          return prev.map((n) =>
            n.type === 'comment' && n.tableId === notif.tableId
              ? { ...n, read: false, count: n.count + 1, lastCommenterUsername: notif.commenterUsername, lastCommentPreview: notif.commentPreview, timestamp: notif.timestamp }
              : n
          );
        }
        return [...prev, { type: 'comment', tableId: notif.tableId, tableName: notif.tableName, count: 1, read: false, lastCommenterUsername: notif.commenterUsername, lastCommentPreview: notif.commentPreview, timestamp: notif.timestamp }];
      });

      setToasts((prev) => pushToast(prev, { type: 'comment', tableId: notif.tableId, tableName: notif.tableName, commenterUsername: notif.commenterUsername, commentPreview: notif.commentPreview }));
    }));

    socket.on('table:image', gated('table:image', (notif) => {
      if (activeTableRef.current === notif.tableId) return;

      setNotifications((prev) => {
        const existing = findExisting(prev, 'image', notif.tableId);
        if (existing) {
          return prev.map((n) =>
            n.type === 'image' && n.tableId === notif.tableId
              ? { ...n, read: false, count: n.count + 1, lastUploaderUsername: notif.uploaderUsername, timestamp: notif.timestamp }
              : n
          );
        }
        return [...prev, { type: 'image', tableId: notif.tableId, tableName: notif.tableName, count: 1, read: false, lastUploaderUsername: notif.uploaderUsername, timestamp: notif.timestamp }];
      });

      setToasts((prev) => pushToast(prev, { type: 'image', tableId: notif.tableId, tableName: notif.tableName, uploaderUsername: notif.uploaderUsername }));
    }));

    socket.on('table:spot-opened', gated('table:spot-opened', (notif) => {
      if (activeTableRef.current === notif.tableId) return;

      setNotifications((prev) => {
        const rest = prev.filter((n) => !(n.type === 'spot_opened' && n.tableId === notif.tableId));
        return [...rest, { type: 'spot_opened', tableId: notif.tableId, tableName: notif.tableName, count: 1, read: false, timestamp: notif.timestamp }];
      });

      setToasts((prev) => pushToast(prev, { type: 'spot_opened', tableId: notif.tableId, tableName: notif.tableName }));
    }));

    socket.on('join:request', gated('join:request', (notif) => {
      if (activeTableRef.current === notif.tableId) return;

      setNotifications((prev) => {
        const existing = findExisting(prev, 'join_request', notif.tableId);
        if (existing) {
          return prev.map((n) =>
            n.type === 'join_request' && n.tableId === notif.tableId
              ? { ...n, read: false, count: n.count + 1, lastRequesterUsername: notif.requesterUsername, timestamp: notif.timestamp }
              : n
          );
        }
        return [...prev, { type: 'join_request', tableId: notif.tableId, tableName: notif.tableName, count: 1, read: false, lastRequesterUsername: notif.requesterUsername, timestamp: notif.timestamp }];
      });

      setToasts((prev) => pushToast(prev, { type: 'join_request', tableId: notif.tableId, tableName: notif.tableName, requesterUsername: notif.requesterUsername }));
    }));

    socket.on('friend:request', gated('friend:request', (notif) => {
      setNotifications((prev) => {
        const existing = prev.find((n) => n.type === 'friend_request' && n.fromUserId === notif.fromUserId);
        if (existing) return prev;
        return [...prev, { type: 'friend_request', fromUserId: notif.fromUserId, fromUsername: notif.fromUsername, count: 1, read: false, timestamp: new Date().toISOString() }];
      });
      setToasts((prev) => pushToast(prev, { type: 'friend_request', fromUserId: notif.fromUserId, fromUsername: notif.fromUsername }));
    }));

    socket.on('friend:accepted', gated('friend:accepted', (notif) => {
      setNotifications((prev) => {
        const existing = prev.find((n) => n.type === 'friend_accepted' && n.fromUserId === notif.fromUserId);
        if (existing) return prev;
        return [...prev, { type: 'friend_accepted', fromUserId: notif.fromUserId, fromUsername: notif.fromUsername, count: 1, read: false, timestamp: new Date().toISOString() }];
      });
      setToasts((prev) => pushToast(prev, { type: 'friend_accepted', fromUserId: notif.fromUserId, fromUsername: notif.fromUsername }));
      refreshUser().catch(() => {});
      friendListenersRef.current.forEach((fn) => fn());
    }));

    socket.on('dm:message', gated('dm:message', (msg) => {
      const fromId = (msg.from?._id || msg.from || '').toString();
      const fromUsername = msg.from?.username || '?';
      const preview = (msg.content || '').slice(0, 60);

      setNotifications((prev) => {
        const existing = prev.find((n) => n.type === 'dm' && n.fromUserId === fromId);
        if (existing) {
          return prev.map((n) =>
            n.type === 'dm' && n.fromUserId === fromId
              ? { ...n, read: false, count: (n.count || 1) + 1, lastMessagePreview: preview, fromUsername, timestamp: new Date().toISOString() }
              : n
          );
        }
        return [...prev, { type: 'dm', fromUserId: fromId, fromUsername, lastMessagePreview: preview, count: 1, read: false, timestamp: new Date().toISOString() }];
      });

      dmListenersRef.current.forEach((fn) => fn(msg));
    }));

    socket.on('admin:message', (msg) => {
      const senderUsername = msg.from?.username || '?';
      const preview = (msg.content || '').slice(0, 60);

      if (adminChatActiveRef.current) {
        // Already viewing admin chat: keep server notif in sync (marked read)
        axios.patch('/api/admin-chat/read').catch(() => {});
        return;
      }

      setNotifications((prev) => {
        const existing = prev.find((n) => n.type === 'admin_chat');
        if (existing) {
          return prev.map((n) =>
            n.type === 'admin_chat'
              ? { ...n, read: false, count: (n.count || 1) + 1, lastSenderUsername: senderUsername, lastMessagePreview: preview, timestamp: new Date().toISOString() }
              : n
          );
        }
        return [...prev, { type: 'admin_chat', lastSenderUsername: senderUsername, lastMessagePreview: preview, count: 1, read: false, timestamp: new Date().toISOString() }];
      });
    });

    const handleTorneoEvent = (eventType) => (notif) => {
      setNotifications((prev) => {
        const rest = prev.filter((n) => !(n.type === eventType && n.torneoId === notif.torneoId));
        return [...rest, {
          type: eventType,
          torneoId: notif.torneoId,
          torneoTitle: notif.torneoTitle,
          round: notif.round,
          isPhase: notif.isPhase || false,
          count: 1,
          read: false,
          timestamp: notif.timestamp || new Date().toISOString(),
        }];
      });
      setToasts((prev) => pushToast(prev, {
        type: eventType,
        torneoId: notif.torneoId,
        torneoTitle: notif.torneoTitle,
        round: notif.round,
        isPhase: notif.isPhase || false,
      }));
    };

    socket.on('torneo:registration-accepted', gated('torneo:registration-accepted', handleTorneoEvent('tournament_accepted')));
    socket.on('torneo:registration-rejected', gated('torneo:registration-rejected', handleTorneoEvent('tournament_rejected')));
    socket.on('torneo:advanced',              gated('torneo:advanced',              handleTorneoEvent('tournament_advanced')));
    socket.on('torneo:eliminated',            gated('torneo:eliminated',            handleTorneoEvent('tournament_eliminated')));
    socket.on('torneo:started',               gated('torneo:started',               handleTorneoEvent('tournament_started')));
    socket.on('torneo:finished',              gated('torneo:finished',              handleTorneoEvent('tournament_finished')));

    socket.on('compartida:comment', gated('compartida:comment', (notif) => {
      setNotifications((prev) => {
        const existing = prev.find((n) => n.type === 'compartida_comment' && n.compartidaId === notif.compartidaId);
        if (existing) {
          return prev.map((n) =>
            n.type === 'compartida_comment' && n.compartidaId === notif.compartidaId
              ? { ...n, read: false, count: (n.count || 1) + 1, lastCommenterUsername: notif.commenterUsername, lastCommentPreview: notif.commentPreview, timestamp: notif.timestamp }
              : n
          );
        }
        return [...prev, { type: 'compartida_comment', compartidaId: notif.compartidaId, compartidaTitle: notif.compartidaTitle, count: 1, read: false, lastCommenterUsername: notif.commenterUsername, lastCommentPreview: notif.commentPreview, timestamp: notif.timestamp }];
      });
      setToasts((prev) => pushToast(prev, { type: 'compartida_comment', compartidaId: notif.compartidaId, compartidaTitle: notif.compartidaTitle, commenterUsername: notif.commenterUsername, commentPreview: notif.commentPreview }));
    }));

    socket.on('compartida:like', gated('compartida:like', (notif) => {
      setNotifications((prev) => {
        const existing = prev.find((n) => n.type === 'compartida_like' && n.compartidaId === notif.compartidaId);
        if (existing) {
          return prev.map((n) =>
            n.type === 'compartida_like' && n.compartidaId === notif.compartidaId
              ? { ...n, read: false, count: (n.count || 1) + 1, lastSenderUsername: notif.fromUsername, timestamp: notif.timestamp }
              : n
          );
        }
        return [...prev, { type: 'compartida_like', compartidaId: notif.compartidaId, compartidaTitle: notif.compartidaTitle, count: 1, read: false, lastSenderUsername: notif.fromUsername, timestamp: notif.timestamp }];
      });
      setToasts((prev) => pushToast(prev, { type: 'compartida_like', compartidaId: notif.compartidaId, compartidaTitle: notif.compartidaTitle, fromUsername: notif.fromUsername }));
    }));

    socket.on('table:cancelled', gated('table:cancelled', (notif) => {
      setNotifications((prev) => {
        const rest = prev.filter((n) => !(n.type === 'table_cancelled' && n.tableId === notif.tableId));
        return [...rest, { type: 'table_cancelled', tableId: notif.tableId, tableName: notif.tableName, count: 1, read: false, timestamp: notif.timestamp }];
      });
      setToasts((prev) => pushToast(prev, { type: 'table_cancelled', tableId: notif.tableId, tableName: notif.tableName }));
    }));

    socket.on('join:rejected', gated('join:rejected', (notif) => {
      setNotifications((prev) => {
        const rest = prev.filter((n) => !(n.type === 'join_rejected' && n.tableId === notif.tableId));
        return [...rest, { type: 'join_rejected', tableId: notif.tableId, tableName: notif.tableName, count: 1, read: false, timestamp: notif.timestamp }];
      });
      setToasts((prev) => pushToast(prev, { type: 'join_rejected', tableId: notif.tableId, tableName: notif.tableName }));
    }));

    socket.on('noticia:published', gated('noticia:published', (notif) => {
      setToasts((prev) => pushToast(prev, { type: 'noticia', noticiaId: notif.noticiaId, title: notif.title }));
    }));

    // ── Eventos ───────────────────────────────────────────────────────
    // Único listener para los 5 tipos. El payload trae `type` que mapea 1-a-1
    // a un enum de Notification ('evento_confirmed', 'evento_rejected', etc.).
    // Lo convertimos a "type" interno para mantener el shape de los demás.
    const EVENTO_TYPE_MAP = {
      confirmed: 'evento_confirmed',
      rejected:  'evento_rejected',
      cancelled: 'evento_cancelled',
      updated:   'evento_updated',
      reminder:  'evento_reminder',
    };
    socket.on('evento:notification', gated('evento:notification', (payload) => {
      // El server emite con `type` short ("confirmed") o ya largo ("evento_confirmed")
      // — soportamos ambos para resistir cambios futuros del payload.
      const rawType = payload?.type || '';
      const notifType = EVENTO_TYPE_MAP[rawType] || rawType;
      if (!notifType || !notifType.startsWith('evento_')) return;
      const common = {
        type: notifType,
        eventoId: payload.eventoId,
        eventoTitle: payload.eventoTitle,
        eventoDate: payload.eventoDate || null,
        permanentlyRejected: payload.permanentlyRejected || false,
        changedFields: payload.changedFields || undefined,
      };
      setNotifications((prev) => {
        const rest = prev.filter((n) => !(n.type === notifType && n.eventoId === common.eventoId));
        return [...rest, { ...common, count: 1, read: false, timestamp: new Date().toISOString() }];
      });
      setToasts((prev) => pushToast(prev, common));
    }));

    socket.on('site-config:updated', (config) => {
      applyServerConfig(config);
    });

    return () => socket.disconnect();
    // refreshUser is intentionally omitted — including it would reconnect the socket on every render
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const markRead = useCallback((tableId) => {
    setNotifications((prev) =>
      prev.map((n) => n.tableId === tableId ? { ...n, read: true } : n)
    );
    axios.patch('/api/notifications/read', { tableId }).catch(() => {});
  }, []);

  const markReadFriend = useCallback((fromUserId) => {
    setNotifications((prev) =>
      prev.map((n) => n.fromUserId === fromUserId ? { ...n, read: true } : n)
    );
    axios.patch('/api/notifications/read', { fromUserId }).catch(() => {});
  }, []);

  const markReadTorneo = useCallback((torneoId) => {
    setNotifications((prev) =>
      prev.map((n) => n.torneoId === torneoId ? { ...n, read: true } : n)
    );
    axios.patch('/api/notifications/read', { torneoId }).catch(() => {});
  }, []);

  const markReadCompartida = useCallback((compartidaId) => {
    setNotifications((prev) =>
      prev.map((n) => n.compartidaId === compartidaId ? { ...n, read: true } : n)
    );
    axios.patch('/api/notifications/read', { compartidaId }).catch(() => {});
  }, []);

  const markReadEvento = useCallback((eventoId) => {
    setNotifications((prev) =>
      prev.map((n) => n.eventoId === eventoId ? { ...n, read: true } : n)
    );
    axios.patch('/api/notifications/read', { eventoId }).catch(() => {});
  }, []);

  const markReadDm = useCallback((fromUserId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.type === 'dm' && n.fromUserId === fromUserId) ? { ...n, read: true } : n)
    );
  }, []);

  const markReadAdminChat = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => n.type === 'admin_chat' ? { ...n, read: true } : n)
    );
    axios.patch('/api/admin-chat/read').catch(() => {});
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    axios.delete('/api/notifications').catch(() => {});
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    axios.patch('/api/notifications/read', {}).catch(() => {});
  }, []);

  const loadOlder = useCallback(async () => {
    const oldest = notifications.reduce((min, n) => {
      const t = new Date(n.updatedAt || n.timestamp || 0).getTime();
      return min == null || t < min ? t : min;
    }, null);
    if (oldest == null) return { count: 0 };
    try {
      const { data } = await axios.get('/api/notifications', {
        params: { before: new Date(oldest).toISOString(), limit: 20 },
      });
      setNotifications((prev) => mergeNotifs(prev, data));
      return { count: data.length };
    } catch {
      return { count: 0 };
    }
  }, [notifications]);

  const setActiveTable = useCallback((tableId) => {
    activeTableRef.current = tableId;
    if (tableId) markRead(tableId);
  }, [markRead]);

  const setActiveTorneo = useCallback((torneoId) => {
    if (torneoId) markReadTorneo(torneoId);
  }, [markReadTorneo]);

  const setActiveCompartida = useCallback((compartidaId) => {
    if (compartidaId) markReadCompartida(compartidaId);
  }, [markReadCompartida]);

  const setActiveEvento = useCallback((eventoId) => {
    if (eventoId) markReadEvento(eventoId);
  }, [markReadEvento]);

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

  const setAdminChatActive = useCallback((active) => {
    adminChatActiveRef.current = active;
    if (active) markReadAdminChat();
  }, [markReadAdminChat]);

  const adminChatUnread = notifications
    .filter((n) => n.type === 'admin_chat' && !n.read)
    .reduce((sum, n) => sum + (n.count || 1), 0);

  // Bell badge: exclude dm and admin_chat (they have their own badges on the chat icons)
  const totalUnread = notifications
    .filter((n) => !n.read && n.type !== 'dm' && n.type !== 'admin_chat')
    .reduce((sum, n) => sum + (n.count || 1), 0);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount: totalUnread,
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
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
