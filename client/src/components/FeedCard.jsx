import { Link } from 'react-router-dom';
import styles from './FeedCard.module.css';

const STATUS_LABEL = { open: 'Abierta', full: 'Completa', cancelled: 'Cancelada' };
const STATUS_CLASS = { open: styles.badgeOpen, full: styles.badgeFull, cancelled: styles.badgeCancelled };

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initial(username) {
  return (username || '?')[0].toUpperCase();
}

export default function FeedCard({ table, userId, isPast }) {
  const hostId = (table.host._id || table.host).toString();
  const isHost = hostId === userId.toString();
  const allParticipants = [table.host, ...table.players];
  const visibleChips = allParticipants.slice(0, 5);
  const overflow = allParticipants.length - visibleChips.length;

  return (
    <div className={`${styles.card} ${isPast ? styles.cardPast : ''}`}>
      <div className={styles.topRow}>
        <span className={styles.title}>{table.boardGame}</span>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${isHost ? styles.badgeHost : styles.badgePlayer}`}>
            {isHost ? 'Anfitrión' : 'Jugador'}
          </span>
          <span className={`${styles.badge} ${STATUS_CLASS[table.status]}`}>
            {STATUS_LABEL[table.status]}
          </span>
        </div>
      </div>

      <div className={styles.metaRow}>
        <span className={styles.metaItem}>📅 {formatDate(table.date)}</span>
        {table.location && <span className={styles.metaItem}>📍 {table.location}</span>}
        <span className={styles.metaItem}>
          👥 {table.players.length + 1}/{table.maxPlayers + 1}
        </span>
      </div>

      <div className={styles.bottomRow}>
        <div className={styles.playerChips}>
          {visibleChips.map((p) => (
            <span key={(p._id || p).toString()} className={styles.chip} title={p.username}>
              {initial(p.username)}
            </span>
          ))}
          {overflow > 0 && <span className={styles.chipExtra}>+{overflow}</span>}
        </div>
        <Link to={`/tables/${table._id}`} className={styles.viewLink}>
          Ver mesa →
        </Link>
      </div>
    </div>
  );
}
