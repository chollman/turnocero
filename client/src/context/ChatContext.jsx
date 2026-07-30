import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { useNotifications } from "./NotificationContext";
import { API } from "../api/endpoints";
import { useDmConversationsQuery, dmKeys } from "../queries/dm";

const ChatContext = createContext(null);

const MAX_WINDOWS = 3;

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const { addDmListener, addToast, markReadDm, dmUnreadTotal } =
    useNotifications();
  const queryClient = useQueryClient();

  // conversations: { [userId]: { user: {_id, username}, messages: [], minimized: false, loaded: false } }
  // El conteo de no-leídos vive en NotificationContext (fuente única). Antes
  // este context mantenía un `conv.unread` paralelo que podía desincronizarse
  // del listado de /notificaciones.
  const { data: conversations = {} } = useDmConversationsQuery(user?._id);
  // openOrder: array of userIds in opening order (left to right on screen).
  // Puramente de cliente (qué ventanas están abiertas y en qué orden) — no
  // va a la query.
  const [openOrder, setOpenOrder] = useState([]);
  // Ref to avoid stale closures in the dm listener
  const openOrderRef = useRef([]);
  useEffect(() => {
    openOrderRef.current = openOrder;
  }, [openOrder]);
  // Tracks which conversations have been loaded to avoid duplicate API calls
  const loadedRef = useRef({});

  // userIdRef: mismo patrón que NotificationContext — para que setConversations
  // (definida abajo) escriba siempre a la query key del user actual sin tener
  // que estar en las deps de cada callback que la usa.
  const userIdRef = useRef(null);
  useEffect(() => {
    userIdRef.current = user?._id ?? null;
  }, [user]);

  // Shim: el resto del archivo sigue llamando setConversations exactamente
  // como antes — updater funcional en la mayoría de los casos, valor directo
  // en el boot fetch y en el reset de logout (igual que acepta useState) —
  // ahora escribe al cache de TanStack Query en vez de a useState.
  const setConversations = useCallback(
    (updater) =>
      queryClient.setQueryData(
        dmKeys.conversations(userIdRef.current),
        (prev) => (typeof updater === "function" ? updater(prev ?? {}) : updater),
      ),
    [queryClient],
  );

  // Load conversation list on mount; reset entirely on logout
  useEffect(() => {
    if (!user) {
      setConversations({});
      setOpenOrder([]);
      loadedRef.current = {};
      return;
    }
    axios
      .get(API.dm.CONVERSATIONS)
      .then(({ data }) => {
        const next = {};
        data.forEach(({ contact, lastMessage }) => {
          next[contact._id] = {
            user: contact,
            messages: [],
            lastMessage,
            minimized: false,
            loaded: false,
          };
        });
        setConversations(next);
      })
      .catch(() => {});
  }, [user, setConversations]);

  // Register DM message handler with NotificationContext.
  // El conteo de no-leídos lo maneja NotificationContext (fuente única). Acá
  // sólo actualizamos el contenido de la conversación (lastMessage, messages
  // si está cargada) y decidimos si toastear / marcar leída automáticamente
  // si la ventana está abierta + no minimizada.
  useEffect(() => {
    if (!user) return;
    const cleanup = addDmListener((msg) => {
      const fromId = (msg.from._id || msg.from).toString();
      const isCurrentlyOpen = openOrderRef.current.includes(fromId);

      setConversations((prev) => {
        const conv = prev[fromId];
        const isMinimized = conv?.minimized ?? false;

        if (isCurrentlyOpen && !isMinimized) {
          axios.patch(API.dm.READ(fromId)).catch(() => {});
          markReadDm(fromId);
        }

        return {
          ...prev,
          [fromId]: {
            user: conv?.user || {
              _id: fromId,
              username: msg.from.username || "?",
            },
            messages: conv?.loaded
              ? [...(conv.messages || []), msg]
              : conv?.messages || [],
            lastMessage: msg,
            minimized: conv?.minimized ?? false,
            loaded: conv?.loaded ?? false,
          },
        };
      });

      if (!isCurrentlyOpen) {
        addToast({
          type: msg.isNewConversation ? "dm_new" : "dm",
          fromUserId: fromId,
          fromUsername: msg.from.username,
          messagePreview: msg.content.slice(0, 60),
        });
      }
    });
    return cleanup;
  }, [user, addDmListener, addToast, markReadDm, setConversations]);

  const openChat = useCallback(
    (contactUser) => {
      const id = contactUser._id.toString();

      setConversations((prev) => ({
        ...prev,
        [id]: {
          user: contactUser,
          messages: prev[id]?.messages || [],
          minimized: false,
          loaded: prev[id]?.loaded ?? false,
        },
      }));

      setOpenOrder((prev) => {
        if (prev.includes(id)) {
          setConversations((c) => ({
            ...c,
            [id]: { ...c[id], minimized: false },
          }));
          return prev;
        }
        const next = [...prev, id];
        return next.length > MAX_WINDOWS
          ? next.slice(next.length - MAX_WINDOWS)
          : next;
      });

      // Load messages only once (ref guards against React Strict Mode double-invoke)
      if (!loadedRef.current[id]) {
        loadedRef.current[id] = true;
        axios
          .get(API.dm.HISTORY(id))
          .then(({ data }) => {
            setConversations((c) => ({
              ...c,
              [id]: { ...c[id], messages: data, loaded: true },
            }));
          })
          .catch(() => {
            loadedRef.current[id] = false;
          });
        axios.patch(API.dm.READ(id)).catch(() => {});
      }
      markReadDm(id);
    },
    [markReadDm, setConversations],
  );

  const closeChat = useCallback((userId) => {
    const id = userId.toString();
    setOpenOrder((prev) => prev.filter((x) => x !== id));
  }, []);

  // Kept for backwards compatibility — los consumidores que llamaban a esto
  // hoy delegan al markReadDm de NotificationContext. Wrapper no-op para no
  // romper signatures.
  const clearConversationUnread = useCallback(
    (userId) => {
      markReadDm(userId.toString());
    },
    [markReadDm],
  );

  const minimizeChat = useCallback((userId) => {
    const id = userId.toString();
    setConversations((prev) => {
      if (!prev[id]) return prev;
      return { ...prev, [id]: { ...prev[id], minimized: !prev[id].minimized } };
    });
  }, [setConversations]);

  const sendMessage = useCallback(
    async (userId, content) => {
      const id = userId.toString();
      const { data: msg } = await axios.post(API.dm.SEND(id), { content });
      setConversations((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          messages: [...(prev[id]?.messages || []), msg],
          lastMessage: msg,
        },
      }));
      return msg;
    },
    [setConversations],
  );

  // dmUnreadTotal viene de NotificationContext (fuente única). Re-exportamos
  // para los consumidores (Navbar, ChatLauncher) sin romper su contrato.

  const value = useMemo(
    () => ({
      conversations,
      openOrder,
      openChat,
      closeChat,
      clearConversationUnread,
      minimizeChat,
      sendMessage,
      dmUnreadTotal,
    }),
    [
      conversations,
      openOrder,
      openChat,
      closeChat,
      clearConversationUnread,
      minimizeChat,
      sendMessage,
      dmUnreadTotal,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
