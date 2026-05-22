import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay, DELETED_USER_LABEL } from "../../utils/userDisplay";
import { STORAGE_KEYS } from "../../utils/storageKeys";
import { getErrorMessage } from "../../utils/getErrorMessage";
import styles from "./TableDetail.module.css";

const formatTime = (dateStr) =>
  new Date(dateStr).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

const SendIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon
      points="22 2 15 22 11 13 2 9 22 2"
      fill="currentColor"
      stroke="none"
    />
  </svg>
);

// Chat panel del detalle de mesa. Owna su propio state (mensajes, input,
// loading) y el ciclo de vida del socket. Antes vivía como ~150 líneas
// adentro de TableDetail.jsx con 4 useStates dispersos entre 27 del padre
// y un useEffect que mezclaba fetch inicial con socket subscribe.
//
// Solo se monta cuando el viewer es participante de la mesa (el chat es
// privado). El componente padre decide cuándo renderizarlo; acá asumimos
// que `user` está definido y que el server autoriza la lectura.
export default function TableChat({
  tableId,
  user,
  isViewingAsAdmin,
  className = "",
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messageListRef = useRef(null);
  const socketRef = useRef(null);

  // Carga inicial de mensajes. Si la API falla devolvemos lista vacía —
  // el chat sigue siendo usable (mensajes nuevos se reciben vía socket).
  useEffect(() => {
    let cancelled = false;
    axios
      .get(`/api/tables/${tableId}/messages`)
      .then(({ data }) => {
        if (!cancelled) setMessages(data);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tableId]);

  // Socket lifecycle. Hay que registrar el listener ANTES de emitir
  // `join:table` para no perder los primeros eventos (memory:
  // `feedback_socket_handler_race`). El cleanup desconecta el socket
  // entero, lo cual también remueve los listeners.
  useEffect(() => {
    if (!user) return undefined;
    let token = null;
    try {
      token = window.localStorage.getItem(STORAGE_KEYS.TOKEN);
    } catch {
      /* modo privado: socket fallará la auth, OK para fallback de UI */
    }
    const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket"],
    });
    socketRef.current = socket;
    socket.on("chat:message", (msg) => {
      setMessages((prev) =>
        prev.some((m) => m._id === msg._id) ? prev : [...prev, msg],
      );
    });
    socket.emit("join:table", tableId);
    return () => {
      socket.emit("leave:table", tableId);
      socket.disconnect();
    };
  }, [tableId, user]);

  // Auto-scroll al fondo cuando llegan mensajes nuevos.
  useEffect(() => {
    const list = messageListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setError("");
    setInput("");
    try {
      const { data } = await axios.post(`/api/tables/${tableId}/messages`, {
        content,
      });
      setMessages((prev) =>
        prev.some((m) => m._id === data._id) ? prev : [...prev, data],
      );
    } catch (err) {
      setError(getErrorMessage(err, "Error al enviar el mensaje"));
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`${styles.chatPanel} ${className}`}>
      <div className={styles.chatHeader}>
        <span className={styles.eyebrow}>CHAT DE LA MESA</span>
        <span className={styles.chatSubtitle}>
          {isViewingAsAdmin
            ? "Vista de administrador"
            : "Solo visible para los participantes"}
        </span>
      </div>

      <div className={styles.messageList} ref={messageListRef}>
        {messages.length === 0 && (
          <p className={styles.emptyChat}>
            Nadie habló todavía. ¡Rompé el hielo! 🎲
          </p>
        )}
        {messages.map((msg) => {
          const senderInfo = getUserDisplay(msg.sender);
          const isOwn =
            msg.sender &&
            (msg.sender._id || msg.sender).toString() === user._id.toString();
          return (
            <div
              key={msg._id}
              className={`${styles.message} ${isOwn ? styles.ownMessage : styles.otherMessage}`}
            >
              {!isOwn && <Avatar user={msg.sender} size="xs" />}
              <div className={styles.msgContent}>
                {!isOwn && (
                  <span className={styles.senderName}>
                    {senderInfo.isDeleted
                      ? DELETED_USER_LABEL
                      : msg.sender.username}
                  </span>
                )}
                <div className={styles.bubble}>{msg.content}</div>
                <span className={styles.messageTime}>
                  {formatTime(msg.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className={styles.chatError}>{error}</p>}

      {!isViewingAsAdmin && (
        <form className={styles.inputRow} onSubmit={sendMessage}>
          <input
            className={styles.chatInput}
            type="text"
            placeholder="Escribí un mensaje…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1000}
          />
          <button
            className={styles.sendCircle}
            type="submit"
            disabled={!input.trim() || sending}
          >
            <SendIcon />
          </button>
        </form>
      )}
    </div>
  );
}
