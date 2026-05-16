import { useEffect } from 'react';
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
};

function ToastItem({ toast, onDismiss }) {
  const navigate = useNavigate();
  const { openChat, conversations } = useChat();
  const duration = DURATION[toast.type] ?? 4000;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  const handleClick = () => {
    if (toast.type === 'friend_request' || toast.type === 'friend_accepted') {
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
      navigate(`/torneos/${toast.torneoId}`);
    } else {
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
    toast.type === 'tournament_pending'    ? '⏳' : '🎲';

  const title =
    toast.type === 'join_accepted'         ? '¡Fuiste aceptado!' :
    toast.type === 'spot_opened'           ? '¡Se liberó un lugar!' :
    toast.type === 'friend_request'        ? `${toast.fromUsername}` :
    toast.type === 'friend_accepted'       ? `${toast.fromUsername}` :
    toast.type === 'dm_new'                ? `${toast.fromUsername}` :
    toast.type === 'dm'                    ? `${toast.fromUsername}` :
    toast.type === 'tournament_accepted'   ? '¡Inscripción aprobada!' :
    toast.type === 'tournament_rejected'   ? 'Inscripción rechazada' :
    toast.type === 'tournament_advanced'   ? '¡Pasaste de ronda!' :
    toast.type === 'tournament_eliminated' ? 'Quedaste fuera del torneo' :
    toast.type === 'tournament_pending'    ? 'Inscripción enviada' :
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
                              : `Ya sos parte de la mesa de ${toast.tableName}`;

  return (
    <div className={styles.toast} onClick={handleClick} role="alert">
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
        style={{ animationDuration: `${duration}ms` }}
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
