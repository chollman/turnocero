import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay, DELETED_USER_LABEL } from "../../utils/userDisplay";
import { STORAGE_KEYS } from "../../utils/storageKeys";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { API } from "../../api/endpoints";
import styles from "./TableDetail.module.css";

const formatTime = (dateStr) =>
  new Date(dateStr).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

const SendIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
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
// loading) y el ciclo de vida del socket. Solo se monta cuando el viewer
// es participante (el chat es privado).
//
// Layout sigue el handoff (mesas-styles.css → .chatPreview / .chatRow /
// .chatBubble): la card del chat NO tiene altura fija ni scroll interno
// dedicado — crece con el contenido. La sección padre (TableDetail)
// renderiza el header "◆ Chat de la mesa", así que acá no repetimos el
// eyebrow.
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

  useEffect(() => {
    let cancelled = false;
    axios
      .get(API.tables.MESSAGES(tableId))
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

  // Auto-scroll al fondo cuando llegan mensajes nuevos. El contenedor sólo
  // hace scroll cuando supera max-height (definido en el CSS), así que en
  // chats cortos no notás scroll alguno — replica el handoff.
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
      const { data } = await axios.post(API.tables.MESSAGES(tableId), {
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
    <div className={`${styles.chatPreview} ${className}`}>
      <div className={styles.chatRows} ref={messageListRef}>
        {messages.length === 0 && (
          <p className={styles.chatEmpty}>
            Sin mensajes todavía · empezá la conversación
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
              className={`${styles.chatRow} ${isOwn ? styles.chatRowOwn : ""}`}
            >
              <Avatar user={msg.sender} size="xs" className={styles.chatAv} />
              <div className={styles.chatBubble}>
                <span className={styles.chatAuthor}>
                  {senderInfo.isDeleted
                    ? DELETED_USER_LABEL
                    : isOwn
                      ? "Vos"
                      : msg.sender.username}
                </span>
                <span className={styles.chatText}>{msg.content}</span>
                <span className={styles.chatTime}>
                  {formatTime(msg.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className={styles.chatError}>{error}</p>}

      {!isViewingAsAdmin && (
        <form className={styles.chatForm} onSubmit={sendMessage}>
          <input
            className={styles.chatInput}
            type="text"
            placeholder="Escribí un mensaje…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1000}
            aria-label="Mensaje"
          />
          <button
            className={styles.chatSubmit}
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="Enviar mensaje"
          >
            <SendIcon />
          </button>
        </form>
      )}
    </div>
  );
}
