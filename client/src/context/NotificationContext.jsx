import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);
const STORAGE_KEY = 'turnocero_notifications';

function loadFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

const findExisting = (prev, type, tableId) =>
  prev.find((n) => (n.type ?? 'chat') === type && n.tableId === tableId);

const makeToastId = () => `${Date.now()}-${Math.random()}`;

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState(loadFromStorage);
  const [toasts, setToasts] = useState([]);
  const activeTableRef = useRef(null);

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
              ? { ...n, count: n.count + 1, lastSenderUsername: notif.senderUsername, lastMessagePreview: notif.messagePreview, timestamp: notif.timestamp }
              : n
          );
        }
        return [...prev, { type: 'chat', tableId: notif.tableId, tableName: notif.tableName, count: 1, lastSenderUsername: notif.senderUsername, lastMessagePreview: notif.messagePreview, timestamp: notif.timestamp }];
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
        return [...rest, { type: 'join_accepted', tableId: notif.tableId, tableName: notif.tableName, count: 1, timestamp: notif.timestamp }];
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
              ? { ...n, count: n.count + 1, lastCommenterUsername: notif.commenterUsername, lastCommentPreview: notif.commentPreview, timestamp: notif.timestamp }
              : n
          );
        }
        return [...prev, { type: 'comment', tableId: notif.tableId, tableName: notif.tableName, count: 1, lastCommenterUsername: notif.commenterUsername, lastCommentPreview: notif.commentPreview, timestamp: notif.timestamp }];
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
              ? { ...n, count: n.count + 1, lastUploaderUsername: notif.uploaderUsername, timestamp: notif.timestamp }
              : n
          );
        }
        return [...prev, { type: 'image', tableId: notif.tableId, tableName: notif.tableName, count: 1, lastUploaderUsername: notif.uploaderUsername, timestamp: notif.timestamp }];
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
        return [...rest, { type: 'spot_opened', tableId: notif.tableId, tableName: notif.tableName, count: 1, timestamp: notif.timestamp }];
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
              ? { ...n, count: n.count + 1, lastRequesterUsername: notif.requesterUsername, timestamp: notif.timestamp }
              : n
          );
        }
        return [...prev, { type: 'join_request', tableId: notif.tableId, tableName: notif.tableName, count: 1, lastRequesterUsername: notif.requesterUsername, timestamp: notif.timestamp }];
      });

      setToasts((prev) => {
        const next = [...prev, { id: makeToastId(), type: 'join_request', tableId: notif.tableId, tableName: notif.tableName, requesterUsername: notif.requesterUsername }];
        return next.length > 4 ? next.slice(-4) : next;
      });
    });

    return () => socket.disconnect();
  }, [user]);

  const markRead = useCallback((tableId) => {
    setNotifications((prev) => prev.filter((n) => n.tableId !== tableId));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const setActiveTable = useCallback((tableId) => {
    activeTableRef.current = tableId;
    if (tableId) markRead(tableId);
  }, [markRead]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const totalUnread = notifications.reduce((sum, n) => sum + (n.count || 1), 0);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount: totalUnread,
      markRead,
      clearAll,
      setActiveTable,
      toasts,
      dismissToast,
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
