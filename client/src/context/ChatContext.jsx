import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

const ChatContext = createContext(null);

const MAX_WINDOWS = 3;

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const { addDmListener, addToast } = useNotifications();

  // conversations: { [userId]: { user: {_id, username}, messages: [], unread: 0, minimized: false, loaded: false } }
  const [conversations, setConversations] = useState({});
  // openOrder: array of userIds in opening order (left to right on screen)
  const [openOrder, setOpenOrder] = useState([]);
  // Ref to avoid stale closures in the dm listener
  const openOrderRef = useRef([]);
  useEffect(() => { openOrderRef.current = openOrder; }, [openOrder]);
  // Tracks which conversations have been loaded to avoid duplicate API calls
  const loadedRef = useRef({});

  // Load conversation list on mount to populate unread totals
  useEffect(() => {
    if (!user) return;
    axios.get('/api/dm').then(({ data }) => {
      setConversations((prev) => {
        const next = { ...prev };
        data.forEach(({ contact, unread }) => {
          if (!next[contact._id]) {
            next[contact._id] = { user: contact, messages: [], unread, minimized: false, loaded: false };
          }
        });
        return next;
      });
    }).catch(() => {});
  }, [user]);

  // Register DM message handler with NotificationContext
  useEffect(() => {
    if (!user) return;
    const cleanup = addDmListener((msg) => {
      const fromId = (msg.from._id || msg.from).toString();
      const isCurrentlyOpen = openOrderRef.current.includes(fromId);

      setConversations((prev) => {
        const conv = prev[fromId];
        const isMinimized = conv?.minimized ?? false;
        const shouldIncrementUnread = !isCurrentlyOpen || isMinimized;

        if (isCurrentlyOpen && !isMinimized) {
          axios.patch(`/api/dm/${fromId}/read`).catch(() => {});
        }

        return {
          ...prev,
          [fromId]: {
            user: conv?.user || { _id: fromId, username: msg.from.username || '?' },
            messages: conv?.loaded ? [...(conv.messages || []), msg] : (conv?.messages || []),
            unread: shouldIncrementUnread ? (conv?.unread || 0) + 1 : 0,
            minimized: conv?.minimized ?? false,
            loaded: conv?.loaded ?? false,
          },
        };
      });

      if (!isCurrentlyOpen) {
        addToast({
          type: msg.isNewConversation ? 'dm_new' : 'dm',
          fromUserId: fromId,
          fromUsername: msg.from.username,
          messagePreview: msg.content.slice(0, 60),
        });
      }
    });
    return cleanup;
  }, [user, addDmListener, addToast]);

  const openChat = useCallback((contactUser) => {
    const id = contactUser._id.toString();

    setConversations((prev) => ({
      ...prev,
      [id]: {
        user: contactUser,
        messages: prev[id]?.messages || [],
        unread: 0,
        minimized: false,
        loaded: prev[id]?.loaded ?? false,
      },
    }));

    setOpenOrder((prev) => {
      if (prev.includes(id)) {
        setConversations((c) => ({ ...c, [id]: { ...c[id], minimized: false } }));
        return prev;
      }
      const next = [...prev, id];
      return next.length > MAX_WINDOWS ? next.slice(next.length - MAX_WINDOWS) : next;
    });

    // Load messages only once (ref guards against React Strict Mode double-invoke)
    if (!loadedRef.current[id]) {
      loadedRef.current[id] = true;
      axios.get(`/api/dm/${id}`).then(({ data }) => {
        setConversations((c) => ({
          ...c,
          [id]: { ...c[id], messages: data, loaded: true },
        }));
      }).catch(() => { loadedRef.current[id] = false; });
      axios.patch(`/api/dm/${id}/read`).catch(() => {});
    }
  }, []);

  const closeChat = useCallback((userId) => {
    const id = userId.toString();
    setOpenOrder((prev) => prev.filter((x) => x !== id));
  }, []);

  const minimizeChat = useCallback((userId) => {
    const id = userId.toString();
    setConversations((prev) => {
      if (!prev[id]) return prev;
      return { ...prev, [id]: { ...prev[id], minimized: !prev[id].minimized } };
    });
  }, []);

  const sendMessage = useCallback(async (userId, content) => {
    const id = userId.toString();
    const { data: msg } = await axios.post(`/api/dm/${id}`, { content });
    setConversations((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        messages: [...(prev[id]?.messages || []), msg],
      },
    }));
    return msg;
  }, []);

  const dmUnreadTotal = Object.values(conversations).reduce((sum, c) => sum + (c.unread || 0), 0);

  return (
    <ChatContext.Provider value={{
      conversations,
      openOrder,
      openChat,
      closeChat,
      minimizeChat,
      sendMessage,
      dmUnreadTotal,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
