import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import styles from './ToastContainer.module.css';

const DURATION = {
  chat: 4000,
  join_request: 4000,
  join_accepted: 5500,
};

function ToastItem({ toast, onDismiss }) {
  const navigate = useNavigate();
  const duration = DURATION[toast.type] ?? 4000;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  const handleClick = () => {
    navigate(`/tables/${toast.tableId}`);
    onDismiss(toast.id);
  };

  const handleClose = (e) => {
    e.stopPropagation();
    onDismiss(toast.id);
  };

  const icon =
    toast.type === 'join_accepted' ? '✅' :
    toast.type === 'join_request'  ? '🔔' : '🎲';

  const title =
    toast.type === 'join_accepted' ? '¡Fuiste aceptado!' : toast.tableName;

  const body =
    toast.type === 'chat'
      ? `${toast.senderUsername}: ${toast.messagePreview}${toast.messagePreview?.length >= 60 ? '…' : ''}`
      : toast.type === 'join_request'
        ? `${toast.requesterUsername} quiere unirse`
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
