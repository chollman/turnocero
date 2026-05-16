import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);
const STORAGE_KEY = 'turnocero_notifications';
const makeToastId = () => `${Date.now()}-${Math.random()}`;

function loadFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

const findExisting = (prev, type, tableId) =>
  prev.find((n) => (n.type ?? 'chat') === type && n.tableId === tableId);

export function NotificationProvider({ children }) {
  const { user, refreshUser } = useAuth();
  const [notifications, setNotifications] = useState(loadFromStorage);
  const [toasts, setToasts] = useState([]);
  const [adminChatUnread, setAdminChatUnread] = useState(0);
  const activeTableRef = useRef(null);
  const adminChatActiveRef = useRef(false);
  const dmListenersRef = useRef(new Set());
  const friendListenersRef = useRef(new Set());

  // Load from server when user is available; reset entirely on logout
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setToasts([]);
      setAdminChatUnread(0);
      return;
    }
    let cancelled = false;
    axios.get('/api/notifications')
      .then(({ data }) => { if (!cancelled) setNotifications(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const socket = io(socketUrl, { auth: { token }, transports: ['websocket'] });

    socket.on('chat:notification', (notif) => {
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

      setToasts((prev) => {
        const next = [...prev, { id: makeToastId(), type: 'chat', tableId: notif.tableId, tableName: notif.tableName, senderUsername: notif.senderUsername, messagePreview: notif.messagePreview }];
        return next.length > 4 ? next.slice(-4) : next;
      });
    });

    socket.on('join:accepted', (notif) => {
      if (activeTableRef.current === notif.tableId) return;

      setNotifications((prev) => {
        const rest = prev.filter((n) => !(n.type === 'join_accepted' && n.tableId === notif.tableId));
        return [...rest, { type: 'join_accepted', tableId: notif.tableId, tableName: notif.tableName, count: 1, read: false, timestamp: notif.timestamp }];
      });

      setToasts((prev) => {
        const next = [...prev, { id: makeToastId(), type: 'join_accepted', tableId: notif.tableId, tableName: notif.tableName }];
        return next.length > 4 ? next.slice(-4) : next;
      });
    });

    socket.on('table:comment', (notif) => {
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

      setToasts((prev) => {
        const next = [...prev, { id: makeToastId(), type: 'comment', tableId: notif.tableId, tableName: notif.tableName, commenterUsername: notif.commenterUsername, commentPreview: notif.commentPreview }];
        return next.length > 4 ? next.slice(-4) : next;
      });
    });

    socket.on('table:image', (notif) => {
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

      setToasts((prev) => {
        const next = [...prev, { id: makeToastId(), type: 'image', tableId: notif.tableId, tableName: notif.tableName, uploaderUsername: notif.uploaderUsername }];
        return next.length > 4 ? next.slice(-4) : next;
      });
    });

    socket.on('table:spot-opened', (notif) => {
      if (activeTableRef.current === notif.tableId) return;

      setNotifications((prev) => {
        const rest = prev.filter((n) => !(n.type === 'spot_opened' && n.tableId === notif.tableId));
        return [...rest, { type: 'spot_opened', tableId: notif.tableId, tableName: notif.tableName, count: 1, read: false, timestamp: notif.timestamp }];
      });

      setToasts((prev) => {
        const next = [...prev, { id: makeToastId(), type: 'spot_opened', tableId: notif.tableId, tableName: notif.tableName }];
        return next.length > 4 ? next.slice(-4) : next;
      });
    });

    socket.on('join:request', (notif) => {
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

      setToasts((prev) => {
        const next = [...prev, { id: makeToastId(), type: 'join_request', tableId: notif.tableId, tableName: notif.tableName, requesterUsername: notif.requesterUsername }];
        return next.length > 4 ? next.slice(-4) : next;
      });
    });

    socket.on('friend:request', (notif) => {
      setNotifications((prev) => {
        const existing = prev.find((n) => n.type === 'friend_request' && n.fromUserId === notif.fromUserId);
        if (existing) return prev;
        return [...prev, { type: 'friend_request', fromUserId: notif.fromUserId, fromUsername: notif.fromUsername, count: 1, read: false, timestamp: new Date().toISOString() }];
      });
      setToasts((prev) => {
        const next = [...prev, { id: makeToastId(), type: 'friend_request', fromUserId: notif.fromUserId, fromUsername: notif.fromUsername }];
        return next.length > 4 ? next.slice(-4) : next;
      });
    });

    socket.on('friend:accepted', (notif) => {
      setNotifications((prev) => {
        const existing = prev.find((n) => n.type === 'friend_accepted' && n.fromUserId === notif.fromUserId);
        if (existing) return prev;
        return [...prev, { type: 'friend_accepted', fromUserId: notif.fromUserId, fromUsername: notif.fromUsername, count: 1, read: false, timestamp: new Date().toISOString() }];
      });
      setToasts((prev) => {
        const next = [...prev, { id: makeToastId(), type: 'friend_accepted', fromUserId: notif.fromUserId, fromUsername: notif.fromUsername }];
        return next.length > 4 ? next.slice(-4) : next;
      });
      refreshUser().catch(() => {});
      friendListenersRef.current.forEach((fn) => fn());
    });

    socket.on('dm:message', (msg) => {
      dmListenersRef.current.forEach((fn) => fn(msg));
    });

    socket.on('admin:message', () => {
      if (!adminChatActiveRef.current) {
        setAdminChatUnread((prev) => prev + 1);
      }
    });

    const handleTorneoEvent = (eventType) => (notif) => {
      setNotifications((prev) => {
        const rest = prev.filter((n) => !(n.type === eventType && n.torneoId === notif.torneoId));
        return [...rest, {
          type: eventType,
          torneoId: notif.torneoId,
          torneoTitle: notif.torneoTitle,
          round: notif.round,
          count: 1,
          read: false,
          timestamp: notif.timestamp || new Date().toISOString(),
        }];
      });
      setToasts((prev) => {
        const next = [...prev, {
          id: makeToastId(),
          type: eventType,
          torneoId: notif.torneoId,
          torneoTitle: notif.torneoTitle,
          round: notif.round,
        }];
        return next.length > 4 ? next.slice(-4) : next;
      });
    };

    socket.on('torneo:registration-accepted', handleTorneoEvent('tournament_accepted'));
    socket.on('torneo:registration-rejected', handleTorneoEvent('tournament_rejected'));
    socket.on('torneo:advanced',              handleTorneoEvent('tournament_advanced'));
    socket.on('torneo:eliminated',            handleTorneoEvent('tournament_eliminated'));

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

  const clearAll = useCallback(() => {
    setNotifications([]);
    axios.delete('/api/notifications').catch(() => {});
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    axios.patch('/api/notifications/read', {}).catch(() => {});
  }, []);

  const setActiveTable = useCallback((tableId) => {
    activeTableRef.current = tableId;
    if (tableId) markRead(tableId);
  }, [markRead]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast) => {
    setToasts((prev) => {
      const next = [...prev, { id: makeToastId(), ...toast }];
      return next.length > 4 ? next.slice(-4) : next;
    });
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
    if (active) setAdminChatUnread(0);
  }, []);

  const totalUnread = notifications.filter((n) => !n.read).reduce((sum, n) => sum + (n.count || 1), 0);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount: totalUnread,
      markRead,
      markReadFriend,
      markReadTorneo,
      markAllRead,
      clearAll,
      setActiveTable,
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
