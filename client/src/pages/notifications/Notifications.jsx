import { Link, useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import styles from './Notifications.module.css';

function getNotifMeta(n) {
  const isAccepted = n.type === 'join_accepted';
  const isRequest  = n.type === 'join_request';

  const icon = isAccepted ? '✅' : isRequest ? '🔔' : '🎲';

  const countLabel = isAccepted
    ? '¡Aceptado!'
    : isRequest
      ? `${n.count} ${n.count === 1 ? 'solicitud' : 'solicitudes'}`
      : `${n.count} ${n.count === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}`;

  const preview = isAccepted
    ? `Ya sos parte de la mesa de ${n.tableName}`
    : isRequest
      ? `${n.lastRequesterUsername} quiere unirse`
      : `${n.lastSenderUsername}: ${n.lastMessagePreview}${(n.lastMessagePreview?.length ?? 0) >= 60 ? '…' : ''}`;

  const chipClass = isAccepted ? 'accepted' : isRequest ? 'request' : 'chat';

  return { icon, countLabel, preview, chipClass };
}

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, markRead, markReadFriend, clearAll } = useNotifications();
  const sorted = [...notifications].reverse();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          ← Volver
        </button>
        <h1 className={styles.title}>Notificaciones</h1>
        {notifications.length > 0 && (
          <button className={styles.clearBtn} onClick={() => { clearAll(); navigate(-1); }}>
            Limpiar
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🔔</span>
          <p className={styles.emptyText}>Sin notificaciones</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {sorted.map((n) => {
            const { icon, countLabel, preview, chipClass } = getNotifMeta(n);
            const to = n.fromUserId ? `/usuarios/${n.fromUserId}` : `/mesas/${n.tableId}`;
            const handleClick = () => n.fromUserId ? markReadFriend(n.fromUserId) : markRead(n.tableId);
            return (
              <li key={`${n.type ?? 'chat'}:${n.tableId ?? n.fromUserId}`}>
                <Link
                  to={to}
                  className={`${styles.card} ${n.read ? styles.cardRead : ''}`}
                  onClick={handleClick}
                >
                  <div className={styles.cardIconWrap}>
                    <span className={styles.cardIcon}>{icon}</span>
                    {!n.read && <span className={styles.unreadDot} />}
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}>
                      <span className={styles.cardGame}>{n.tableName || n.fromUsername}</span>
                      {!n.read && (
                        <span className={`${styles.chip} ${styles[chipClass]}`}>
                          {countLabel}
                        </span>
                      )}
                    </div>
                    <span className={styles.cardPreview}>{preview}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
