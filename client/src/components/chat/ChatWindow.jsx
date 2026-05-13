import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useChat } from '../../context/ChatContext';
import styles from './ChatWindow.module.css';

function formatTime(date) {
  return new Date(date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatWindow({ userId, index, currentUserId }) {
  const { conversations, closeChat, minimizeChat, sendMessage } = useChat();
  const conv = conversations[userId];
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messageListRef = useRef(null);

  // Right offset: leave 80px on the right for the ChatLauncher FAB button
  const rightOffset = 80 + index * (280 + 10);

  useEffect(() => {
    if (!conv?.minimized && messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [conv?.messages, conv?.minimized]);

  if (!conv) return null;

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

  return (
    <div
      className={`${styles.window} ${conv.minimized ? styles.minimized : ''}`}
      style={{ right: rightOffset }}
    >
      <div className={styles.header} onClick={() => minimizeChat(userId)}>
        <div className={styles.headerLeft}>
          <span className={styles.avatar}>{conv.user.username[0].toUpperCase()}</span>
          <span className={styles.username}>{conv.user.username}</span>
          {conv.minimized && conv.unread > 0 && (
            <span className={styles.unreadBadge}>{conv.unread > 9 ? '9+' : conv.unread}</span>
          )}
        </div>
        <div className={styles.headerActions}>
          <Link
            to={`/usuarios/${userId}`}
            className={styles.headerBtn}
            onClick={(e) => e.stopPropagation()}
            title="Ver perfil"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </Link>
          <button
            className={styles.headerBtn}
            onClick={(e) => { e.stopPropagation(); minimizeChat(userId); }}
            title={conv.minimized ? 'Expandir' : 'Minimizar'}
          >
            {conv.minimized ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            )}
          </button>
          <button
            className={styles.headerBtn}
            onClick={(e) => { e.stopPropagation(); closeChat(userId); }}
            title="Cerrar"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      {!conv.minimized && (
        <>
          <div className={styles.messages} ref={messageListRef}>
            {!conv.loaded && (
              <div className={styles.loading}>Cargando...</div>
            )}
            {conv.messages.map((msg) => {
              const isOwn = (msg.from._id || msg.from).toString() === currentUserId;
              return (
                <div key={msg._id} className={`${styles.message} ${isOwn ? styles.own : styles.other}`}>
                  <div className={styles.bubble}>{msg.content}</div>
                  <span className={styles.time}>{formatTime(msg.createdAt)}</span>
                </div>
              );
            })}
          </div>
          <form className={styles.inputRow} onSubmit={handleSend}>
            <input
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribir..."
              maxLength={1000}
              autoComplete="off"
            />
            <button className={styles.sendBtn} type="submit" disabled={sending || !input.trim()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
              </svg>
            </button>
          </form>
        </>
      )}
    </div>
  );
}
