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

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState(loadFromStorage);
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
              ? {
                  ...n,
                  count: n.count + 1,
                  lastSenderUsername: notif.senderUsername,
                  lastMessagePreview: notif.messagePreview,
                  timestamp: notif.timestamp,
                }
              : n
          );
        }
        return [...prev, {
          type: 'chat',
          tableId: notif.tableId,
          tableName: notif.tableName,
          count: 1,
          lastSenderUsername: notif.senderUsername,
          lastMessagePreview: notif.messagePreview,
          timestamp: notif.timestamp,
        }];
      });
    });

    socket.on('join:request', (notif) => {
      if (activeTableRef.current === notif.tableId) return;
      setNotifications((prev) => {
        const existing = findExisting(prev, 'join_request', notif.tableId);
        if (existing) {
          return prev.map((n) =>
            n.type === 'join_request' && n.tableId === notif.tableId
              ? {
                  ...n,
                  count: n.count + 1,
                  lastRequesterUsername: notif.requesterUsername,
                  timestamp: notif.timestamp,
                }
              : n
          );
        }
        return [...prev, {
          type: 'join_request',
          tableId: notif.tableId,
          tableName: notif.tableName,
          count: 1,
          lastRequesterUsername: notif.requesterUsername,
          timestamp: notif.timestamp,
        }];
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

  const totalUnread = notifications.reduce((sum, n) => sum + (n.count || 1), 0);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount: totalUnread,
      markRead,
      clearAll,
      setActiveTable,
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
