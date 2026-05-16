import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import styles from './DirectChat.module.css';

function formatTime(date) {
  return new Date(date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function DirectChat() {
  const { userId } = useParams();
  const { user } = useAuth();
  const { conversations, openChat, sendMessage } = useChat();
  const navigate = useNavigate();
  const [contact, setContact] = useState(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messageListRef = useRef(null);
  const loadedCountRef = useRef(null);

  const conv = conversations[userId];

  // Load contact info and open chat in context
  useEffect(() => {
    axios.get(`/api/users/${userId}`)
      .then(({ data }) => {
        setContact(data.user || data);
        openChat(data.user || data);
      })
      .catch(() => navigate('/mensajes', { replace: true }));
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [conv?.messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput('');
    try {
      await sendMessage(userId, content);
    } catch {
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  const messages = conv?.messages || [];

  // Snapshot the count when the conversation first loads so we only animate new arrivals
  if (conv?.loaded && loadedCountRef.current === null) {
    loadedCountRef.current = messages.length;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/mensajes')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <div className={styles.headerInfo}>
          <span className={styles.headerAvatar}>
            {(contact?.username || '?')[0].toUpperCase()}
          </span>
          <span className={styles.headerName}>{contact?.username || '...'}</span>
        </div>
        {contact && (
          <Link to={`/usuarios/${userId}`} className={styles.profileBtn} title="Ver perfil">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </Link>
        )}
      </div>

      <div className={styles.messages} ref={messageListRef}>
        {!conv?.loaded && (
          <div className={styles.loading}>Cargando mensajes...</div>
        )}
        {messages.map((msg, i) => {
          const isOwn = msg.from && (msg.from._id || msg.from).toString() === user._id.toString();
          const isNew = loadedCountRef.current !== null && i >= loadedCountRef.current;
          return (
            <div key={msg._id} className={`${styles.message} ${isOwn ? styles.own : styles.other} ${isNew ? styles.messageNew : ''}`}>
              {!isOwn && (
                <span className={styles.senderAvatar}>
                  {(msg.from?.username || '?')[0].toUpperCase()}
                </span>
              )}
              <div className={styles.msgContent}>
                <div className={styles.bubble}>{msg.content}</div>
                <span className={styles.time}>{formatTime(msg.createdAt)}</span>
              </div>
            </div>
          );
        })}
        {sending && (
          <div className={styles.sendingBubble}>
            <span className={styles.sendingDot} />
            <span className={styles.sendingDot} />
            <span className={styles.sendingDot} />
          </div>
        )}
      </div>

      <form className={styles.inputRow} onSubmit={handleSend}>
        <input
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribir mensaje..."
          maxLength={1000}
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
