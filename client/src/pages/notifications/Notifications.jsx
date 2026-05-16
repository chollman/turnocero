import { Link } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import styles from './Notifications.module.css';

function getNotifMeta(n) {
  switch (n.type) {
    case 'join_accepted':
      return {
        icon: '✅',
        countLabel: '¡Aceptado!',
        preview: `Ya sos parte de la mesa de ${n.tableName}`,
        chipClass: 'accepted',
      };
    case 'join_request':
      return {
        icon: '🔔',
        countLabel: `${n.count} ${n.count === 1 ? 'solicitud' : 'solicitudes'}`,
        preview: `${n.lastRequesterUsername} quiere unirse`,
        chipClass: 'request',
      };
    case 'friend_request':
      return {
        icon: '🤝',
        countLabel: 'Solicitud de amistad',
        preview: `${n.fromUsername} te envió una solicitud de amistad`,
        chipClass: 'request',
      };
    case 'friend_accepted':
      return {
        icon: '✅',
        countLabel: '¡Amigos!',
        preview: `${n.fromUsername} aceptó tu solicitud de amistad`,
        chipClass: 'accepted',
      };
    case 'comment':
      return {
        icon: '🗨️',
        countLabel: `${n.count} ${n.count === 1 ? 'comentario nuevo' : 'comentarios nuevos'}`,
        preview: `${n.lastCommenterUsername}: ${n.lastCommentPreview ?? ''}${(n.lastCommentPreview?.length ?? 0) >= 60 ? '…' : ''}`,
        chipClass: 'chat',
      };
    case 'image':
      return {
        icon: '📸',
        countLabel: `${n.count} ${n.count === 1 ? 'foto nueva' : 'fotos nuevas'}`,
        preview: `${n.lastUploaderUsername} subió una foto`,
        chipClass: 'chat',
      };
    case 'spot_opened':
      return {
        icon: '🎯',
        countLabel: '¡Lugar disponible!',
        preview: `Se liberó un lugar en ${n.tableName}`,
        chipClass: 'request',
      };
    case 'tournament_accepted':
      return {
        icon: '🏆',
        countLabel: '¡Inscripción aprobada!',
        preview: `Ya estás dentro del torneo`,
        chipClass: 'accepted',
      };
    case 'tournament_rejected':
      return {
        icon: '🚫',
        countLabel: 'Inscripción rechazada',
        preview: `Tu inscripción al torneo fue rechazada`,
        chipClass: 'request',
      };
    case 'tournament_advanced':
      return {
        icon: '🎉',
        countLabel: '¡Pasaste de ronda!',
        preview: `Avanzaste a la ${n.round ? `ronda ${n.round + 1}` : 'siguiente ronda'}`,
        chipClass: 'accepted',
      };
    case 'tournament_eliminated':
      return {
        icon: '🥲',
        countLabel: 'Quedaste fuera',
        preview: `Suerte la próxima 🎲`,
        chipClass: 'request',
      };
    default:
      return {
        icon: '🎲',
        countLabel: `${n.count} ${n.count === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}`,
        preview: `${n.lastSenderUsername}: ${n.lastMessagePreview ?? ''}${(n.lastMessagePreview?.length ?? 0) >= 60 ? '…' : ''}`,
        chipClass: 'chat',
      };
  }
}

const getNotifTime = (n) => new Date(n.updatedAt || n.timestamp || 0).getTime();

export default function Notifications() {
  const { notifications, markRead, markReadFriend, clearAll } = useNotifications();
  const sorted = [...notifications].sort((a, b) => getNotifTime(b) - getNotifTime(a));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.heroBlock}>
          <div className={styles.eyebrow}>◆ ACTIVIDAD</div>
          <h1 className={styles.heroTitle}>Notificaciones</h1>
          <p className={styles.heroSub}>Tus últimas notificaciones.</p>
        </div>
        {notifications.length > 0 && (
          <button className={styles.clearBtn} onClick={() => clearAll()}>
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
            const isTorneo = n.type?.startsWith('tournament_');
            const to = isTorneo
              ? `/torneos/${n.torneoId}`
              : n.fromUserId ? `/usuarios/${n.fromUserId}` : `/mesas/${n.tableId}`;
            const handleClick = () => {
              if (isTorneo) return;
              if (n.fromUserId) markReadFriend(n.fromUserId);
              else markRead(n.tableId);
            };
            return (
              <li key={`${n.type ?? 'chat'}:${n.tableId ?? n.fromUserId ?? n.torneoId}`}>
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
                      <span className={styles.cardGame}>{n.tableName || n.fromUsername || n.torneoTitle}</span>
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
