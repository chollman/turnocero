import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { io } from 'socket.io-client';
import { GhostIcon } from '../../components/shared/UserRef';
import { getUserDisplay, DELETED_USER_LABEL } from '../../utils/userDisplay';
import styles from './AdminChat.module.css';

function formatTime(date) {
  return new Date(date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

export default function AdminChat() {
  const { user } = useAuth();
  const { setAdminChatActive } = useNotifications();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messageListRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (user && !user.isAdmin) navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    setAdminChatActive(true);
    return () => setAdminChatActive(false);
  }, [setAdminChatActive]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    axios.get('/api/admin-chat')
      .then(({ data }) => setMessages(data))
      .catch(() => {});

    const token = localStorage.getItem('token');
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const socket = io(socketUrl, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('admin:message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => socket.disconnect();
  }, [user?.isAdmin]);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput('');
    try {
      await axios.post('/api/admin-chat', { content });
    } catch {
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <span className={styles.lockIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </span>
          <span className={styles.headerTitle}>Chat Admin</span>
          <span className={styles.headerSub}>Solo visible para administradores</span>
        </div>
      </div>

      <div className={styles.messages} ref={messageListRef}>
        {messages.length === 0 && (
          <div className={styles.empty}>No hay mensajes todavía.</div>
        )}
        {messages.map((msg) => {
          const fromInfo = getUserDisplay(msg.from);
          const isOwn = msg.from && (msg.from._id || msg.from).toString() === user._id.toString();
          return (
            <div key={msg._id} className={`${styles.message} ${isOwn ? styles.own : styles.other}`}>
              <div className={styles.senderInfo}>
                <span className={styles.senderAvatar}>
                  {fromInfo.isDeleted ? <GhostIcon size={12} /> : msg.from.username[0].toUpperCase()}
                </span>
                <span className={styles.senderName}>
                  {fromInfo.isDeleted ? DELETED_USER_LABEL : msg.from.username}
                </span>
              </div>
              <div className={styles.msgContent}>
                <div className={styles.bubble}>{msg.content}</div>
                <span className={styles.time}>{formatTime(msg.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <form className={styles.inputRow} onSubmit={handleSend}>
        <input
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribir mensaje admin..."
          maxLength={2000}
          autoComplete="off"
        />
        <button className={styles.sendBtn} type="submit" disabled={sending || !input.trim()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
          </svg>
        </button>
      </form>
    </div>
  );
}
