import { Link } from 'react-router-dom';
import axios from 'axios';
import { useNotifications } from '../../context/NotificationContext';
import { useChat } from '../../context/ChatContext';
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
    case 'dm':
      return {
        icon: '💬',
        countLabel: `${n.count} ${n.count === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}`,
        preview: `${n.fromUsername}: ${n.lastMessagePreview ?? ''}${(n.lastMessagePreview?.length ?? 0) >= 60 ? '…' : ''}`,
        chipClass: 'chat',
      };
    case 'admin_chat':
      return {
        icon: '🛡️',
        countLabel: `${n.count} ${n.count === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}`,
        preview: `${n.lastSenderUsername}: ${n.lastMessagePreview ?? ''}${(n.lastMessagePreview?.length ?? 0) >= 60 ? '…' : ''}`,
        chipClass: 'chat',
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
  const { notifications, markRead, markReadFriend, markReadTorneo, markReadDm, markReadAdminChat, markAllRead, clearAll } = useNotifications();
  const { clearConversationUnread } = useChat();
  const sorted = [...notifications].sort((a, b) => getNotifTime(b) - getNotifTime(a));
  const hasUnread = notifications.some((n) => !n.read);

  const markNotifRead = (n) => {
    if (n.type === 'admin_chat') return markReadAdminChat();
    if (n.type === 'dm') {
      axios.patch(`/api/dm/${n.fromUserId}/read`).catch(() => {});
      markReadDm(n.fromUserId);
      clearConversationUnread(n.fromUserId);
      return;
    }
    if (n.type?.startsWith('tournament_')) return markReadTorneo(n.torneoId);
    if (n.fromUserId) return markReadFriend(n.fromUserId);
    return markRead(n.tableId);
  };

  const handleClearAll = () => {
    if (!window.confirm('¿Eliminar todas las notificaciones? Esta acción no se puede deshacer.')) return;
    clearAll();
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.heroBlock}>
          <div className={styles.eyebrow}>◆ ACTIVIDAD</div>
          <h1 className={styles.heroTitle}>Notificaciones</h1>
          <p className={styles.heroSub}>Tus últimas notificaciones.</p>
        </div>
        {notifications.length > 0 && (
          <div className={styles.headerActions}>
            <button
              className={styles.markAllBtn}
              onClick={() => markAllRead()}
              disabled={!hasUnread}
            >
              Marcar como leídas
            </button>
            <button className={styles.clearBtn} onClick={handleClearAll}>
              Limpiar
            </button>
          </div>
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
            const to =
              n.type === 'admin_chat' ? '/mensajes-admin' :
              n.type === 'dm' ? `/mensajes/${n.fromUserId}` :
              isTorneo ? `/torneos/${n.torneoId}` :
              n.fromUserId ? `/usuarios/${n.fromUserId}` :
              `/mesas/${n.tableId}`;
            const handleClick = () => markNotifRead(n);
            const handleMarkRead = (e) => {
              e.preventDefault();
              e.stopPropagation();
              markNotifRead(n);
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
                      <span className={styles.cardGame}>
                        {n.type === 'admin_chat'
                          ? 'Chat de admins'
                          : (n.tableName || n.fromUsername || n.torneoTitle)}
                      </span>
                      {!n.read && (
                        <span className={`${styles.chip} ${styles[chipClass]}`}>
                          {countLabel}
                        </span>
                      )}
                    </div>
                    <span className={styles.cardPreview}>{preview}</span>
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      className={styles.markReadBtn}
                      onClick={handleMarkRead}
                      aria-label="Marcar como leída"
                      title="Marcar como leída"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
