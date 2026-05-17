import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { useChat } from '../../context/ChatContext';
import styles from './ToastContainer.module.css';

const DESKTOP = 960;

const DURATION = {
  chat: 4000,
  join_request: 4000,
  join_accepted: 5500,
  spot_opened: 6000,
  comment: 4000,
  image: 4000,
  friend_request: 6000,
  friend_accepted: 5500,
  dm: 4000,
  dm_new: 7000,
  tournament_accepted:   6000,
  tournament_rejected:   6000,
  tournament_advanced:   6000,
  tournament_eliminated: 6000,
  tournament_pending:    5000,
  tournament_started:    6000,
  tournament_finished:   6000,
  compartida_comment:    4000,
  compartida_like:       4000,
  table_cancelled:       6000,
  join_rejected:         5500,
  noticia:               6000,
  bgwatch_connected:     7000,
};

function ToastItem({ toast, onDismiss }) {
  const navigate = useNavigate();
  const { openChat, conversations } = useChat();
  const { markRead, markReadFriend, markReadTorneo, markReadCompartida } = useNotifications();
  const duration = DURATION[toast.type] ?? 4000;
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);
  const remainingRef = useRef(duration);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (paused) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        remainingRef.current -= Date.now() - startRef.current;
      }
      return;
    }
    startRef.current = Date.now();
    timerRef.current = setTimeout(() => onDismiss(toast.id), remainingRef.current);
    return () => clearTimeout(timerRef.current);
  }, [paused, toast.id, onDismiss]);

  const handleClick = () => {
    if (toast.type === 'friend_request' || toast.type === 'friend_accepted') {
      markReadFriend(toast.fromUserId);
      navigate(`/usuarios/${toast.fromUserId}`);
    } else if (toast.type === 'dm' || toast.type === 'dm_new') {
      if (window.innerWidth >= DESKTOP) {
        const conv = conversations[toast.fromUserId];
        const contactUser = conv?.user || { _id: toast.fromUserId, username: toast.fromUsername };
        openChat(contactUser);
      } else {
        navigate(`/mensajes/${toast.fromUserId}`);
      }
    } else if (toast.type?.startsWith('tournament_')) {
      markReadTorneo(toast.torneoId);
      navigate(`/torneos/${toast.torneoId}`);
    } else if (toast.type === 'compartida_comment' || toast.type === 'compartida_like') {
      markReadCompartida(toast.compartidaId);
      navigate(`/compartidas/${toast.compartidaId}`);
    } else if (toast.type === 'noticia') {
      navigate(`/noticias/${toast.noticiaId}`);
    } else if (toast.type === 'bgwatch_connected') {
      navigate(`/bg-watch/${encodeURIComponent(toast.bggUsername)}`);
    } else {
      if (toast.tableId) markRead(toast.tableId);
      navigate(`/mesas/${toast.tableId}`);
    }
    onDismiss(toast.id);
  };

  const handleClose = (e) => {
    e.stopPropagation();
    onDismiss(toast.id);
  };

  const icon =
    toast.type === 'join_accepted'   ? '✅' :
    toast.type === 'join_request'    ? '🔔' :
    toast.type === 'spot_opened'     ? '🎯' :
    toast.type === 'comment'         ? '🗨️' :
    toast.type === 'image'           ? '📸' :
    toast.type === 'friend_request'  ? '🤝' :
    toast.type === 'friend_accepted' ? '✅' :
    toast.type === 'dm_new'          ? '💬' :
    toast.type === 'dm'              ? '💬' :
    toast.type === 'tournament_accepted'   ? '🏆' :
    toast.type === 'tournament_rejected'   ? '🚫' :
    toast.type === 'tournament_advanced'   ? '🎉' :
    toast.type === 'tournament_eliminated' ? '🥲' :
    toast.type === 'tournament_pending'    ? '⏳' :
    toast.type === 'tournament_started'    ? '🚀' :
    toast.type === 'tournament_finished'   ? '🏁' :
    toast.type === 'compartida_comment'    ? '🗨️' :
    toast.type === 'compartida_like'       ? '❤️' :
    toast.type === 'table_cancelled'       ? '❌' :
    toast.type === 'join_rejected'         ? '🚷' :
    toast.type === 'noticia'               ? '📰' :
    toast.type === 'bgwatch_connected'     ? '🎲' : '🎲';

  const title =
    toast.type === 'join_accepted'         ? '¡Fuiste aceptado!' :
    toast.type === 'spot_opened'           ? '¡Se liberó un lugar!' :
    toast.type === 'friend_request'        ? `${toast.fromUsername}` :
    toast.type === 'friend_accepted'       ? `${toast.fromUsername}` :
    toast.type === 'dm_new'                ? `${toast.fromUsername}` :
    toast.type === 'dm'                    ? `${toast.fromUsername}` :
    toast.type === 'tournament_accepted'   ? '¡Inscripción aprobada!' :
    toast.type === 'tournament_rejected'   ? 'Inscripción rechazada' :
    toast.type === 'tournament_advanced'   ? (toast.isPhase ? '¡Pasaste de fase!' : '¡Pasaste de ronda!') :
    toast.type === 'tournament_eliminated' ? 'Quedaste fuera del torneo' :
    toast.type === 'tournament_pending'    ? 'Inscripción enviada' :
    toast.type === 'tournament_started'    ? '¡Empezó el torneo!' :
    toast.type === 'tournament_finished'   ? 'Torneo finalizado' :
    toast.type === 'compartida_comment'    ? `${toast.commenterUsername}` :
    toast.type === 'compartida_like'       ? `${toast.fromUsername}` :
    toast.type === 'table_cancelled'       ? 'Mesa cancelada' :
    toast.type === 'join_rejected'         ? 'Solicitud rechazada' :
    toast.type === 'noticia'               ? 'Nueva noticia' :
    toast.type === 'bgwatch_connected'     ? '¡Conectado a BG Watch!' :
    toast.tableName;

  const body =
    toast.type === 'chat'
      ? `${toast.senderUsername}: ${toast.messagePreview}${toast.messagePreview?.length >= 60 ? '…' : ''}`
      : toast.type === 'join_request'
        ? `${toast.requesterUsername} quiere unirse`
        : toast.type === 'spot_opened'
          ? `Hay un lugar disponible en ${toast.tableName} 🎲 ¡Sumate ahora!`
          : toast.type === 'comment'
            ? `${toast.commenterUsername}: ${toast.commentPreview}${toast.commentPreview?.length >= 60 ? '…' : ''}`
            : toast.type === 'image'
              ? `${toast.uploaderUsername} subió una foto`
              : toast.type === 'friend_request'
                ? 'Te envió una solicitud de amistad · Aceptar o rechazar'
                : toast.type === 'friend_accepted'
                  ? 'Aceptó tu solicitud de amistad'
                  : toast.type === 'dm_new'
                  ? 'Te escribió por primera vez · Tocá para responder'
                  : toast.type === 'dm'
                    ? `${toast.messagePreview}${toast.messagePreview?.length >= 60 ? '…' : ''}`
                    : toast.type === 'tournament_accepted'
                      ? `${toast.torneoTitle} · Ya estás dentro`
                      : toast.type === 'tournament_rejected'
                        ? `${toast.torneoTitle}`
                        : toast.type === 'tournament_advanced'
                          ? `Avanzaste en ${toast.torneoTitle}`
                          : toast.type === 'tournament_eliminated'
                            ? `${toast.torneoTitle} · Suerte la próxima 🎲`
                            : toast.type === 'tournament_pending'
                              ? `${toast.torneoTitle} · Esperá la aprobación del admin`
                              : toast.type === 'tournament_started'
                                ? `${toast.torneoTitle} ya está en juego`
                                : toast.type === 'tournament_finished'
                                  ? `Terminó ${toast.torneoTitle}`
                                  : toast.type === 'compartida_comment'
                                    ? `${toast.commentPreview ?? ''}${toast.commentPreview?.length >= 60 ? '…' : ''}`
                                    : toast.type === 'compartida_like'
                                      ? 'Le dio like a tu compartida'
                                      : toast.type === 'table_cancelled'
                                        ? `Se canceló ${toast.tableName}`
                                        : toast.type === 'join_rejected'
                                          ? `Tu solicitud para ${toast.tableName} fue rechazada`
                                          : toast.type === 'noticia'
                                            ? toast.title
                                            : toast.type === 'bgwatch_connected'
                                              ? 'Tocá para ir a tu BG Watch ahora →'
                                              : `Ya sos parte de la mesa de ${toast.tableName}`;

  return (
    <div
      className={styles.toast}
      onClick={handleClick}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="alert"
    >
      <div className={styles.toastInner}>
        <span className={styles.icon}>{icon}</span>
        <div className={styles.text}>
          <span className={styles.title}>{title}</span>
          <span className={styles.body}>{body}</span>
        </div>
        <button className={styles.close} onClick={handleClose} aria-label="Cerrar">✕</button>
      </div>
      <div
        className={styles.progress}
        style={{
          animationDuration: `${duration}ms`,
          animationPlayState: paused ? 'paused' : 'running',
        }}
      />
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, dismissToast } = useNotifications();
  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}
