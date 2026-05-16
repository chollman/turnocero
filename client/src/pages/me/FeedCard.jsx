import { Link } from 'react-router-dom';
import GameTile from '../../components/shared/GameTile';
import styles from './FeedCard.module.css';

function seedFromId(id = '') {
  let s = 0;
  for (let i = 0; i < id.length; i++) s = (s * 31 + id.charCodeAt(i)) >>> 0;
  return s;
}

function formatCardDate(dateStr) {
  const d = new Date(dateStr);
  const weekday = d.toLocaleString('es-AR', { weekday: 'short' }).toUpperCase().replace('.', '');
  const day = d.toLocaleString('es-AR', { day: 'numeric', month: 'short' }).toUpperCase();
  const time = d.toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return `${weekday} ${day} · ${time}`;
}

export default function FeedCard({ table, userId, isPast }) {
  const hostId = table.host ? (table.host._id || table.host).toString() : null;
  const isHost = hostId && hostId === userId.toString();
  const seed = seedFromId(table._id);
  const dateStr = formatCardDate(table.date);
  const meta = [
    dateStr,
    table.location || null,
    `${table.players.length + 1}/${table.maxPlayers + 1}`,
  ].filter(Boolean).join(' · ');

  return (
    <div className={`${styles.card} ${isPast ? styles.cardPast : ''}`}>
      <div className={styles.tile}>
        <GameTile game={table.boardGame} seed={seed} size={64} imageUrl={table.bggImage || null} />
      </div>
      <div className={styles.body}>
        <div className={styles.topRow}>
          <span className={styles.title}>{table.boardGame}</span>
          <span className={`${styles.roleBadge} ${isHost ? styles.roleBadgeHost : styles.roleBadgePlayer}`}>
            {isHost ? 'HOST' : 'JUGADOR'}
          </span>
        </div>
        <div className={styles.meta}>{meta}</div>
      </div>
      <Link to={`/mesas/${table._id}`} className={styles.viewBtn}>Ver →</Link>
    </div>
  );
}
