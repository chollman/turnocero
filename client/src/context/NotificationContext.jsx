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
        const rest = prev.filter((n) => n.tableId !== notif.tableId);
        return [...rest, notif];
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

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount: notifications.length,
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
