import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import FeedCard from '../components/FeedCard';
import styles from './MeFeed.module.css';

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'host', label: 'Anfitrión' },
  { key: 'player', label: 'Jugador' },
  { key: 'cancelled', label: 'Canceladas' },
];

function formatNextDate(dateStr) {
  return new Date(dateStr).toLocaleString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function NextGameHighlight({ table, userId }) {
  const isHost = (table.host._id || table.host).toString() === userId.toString();
  return (
    <div className={styles.nextGame}>
      <div className={styles.nextGameHeader}>
        <span className={styles.nextGameBadge}>PRÓXIMA MESA</span>
        <span className={`${styles.rolePill} ${isHost ? styles.rolePillHost : styles.rolePillPlayer}`}>
          {isHost ? 'Anfitrión' : 'Jugador'}
        </span>
      </div>
      <div className={styles.nextGameTitle}>{table.boardGame}</div>
      <div className={styles.nextGameMeta}>
        📅 {formatNextDate(table.date)}
        {table.location && <> · 📍 {table.location}</>}
        · 👥 {table.players.length + 1}/{table.maxPlayers + 1}
      </div>
      <Link to={`/tables/${table._id}`} className={styles.nextGameLink}>
        Ver mesa →
      </Link>
    </div>
  );
}

export default function MeFeed() {
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    axios.get('/api/tables/me/feed')
      .then((res) => setTables(res.data.tables))
      .catch(() => setError('No se pudo cargar el historial.'))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const uid = user?._id?.toString();

  const applyFilter = (t) => {
    if (filter === 'all') return true;
    if (filter === 'cancelled') return t.status === 'cancelled';
    const isHost = (t.host._id || t.host).toString() === uid;
    if (filter === 'host') return isHost;
    if (filter === 'player') return !isHost;
    return true;
  };

  const filteredTables = tables.filter(applyFilter);
  const upcoming = filteredTables.filter((t) => new Date(t.date) >= now);
  const past = filteredTables.filter((t) => new Date(t.date) < now);

  // Next game is the earliest upcoming — array is sorted desc, so last of upcoming
  const nextGame = upcoming.length > 0 ? upcoming[upcoming.length - 1] : null;

  // Stats from full (unfiltered) array
  const totalTables = tables.length;
  const asHost = tables.filter((t) => (t.host._id || t.host).toString() === uid).length;
  const asPlayer = totalTables - asHost;
  const upcomingCount = tables.filter((t) => new Date(t.date) >= now).length;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>Mi Historial</h1>
          <p className={styles.heroSub}>Todas tus mesas, en un solo lugar</p>
        </div>

        <div className={styles.statsBar}>
          <div className={styles.statChip}>
            <span className={styles.statNumber}>{totalTables}</span>
            <span className={styles.statLabel}>mesas en total</span>
          </div>
          <div className={styles.statChip}>
            <span className={styles.statNumber}>{asHost}</span>
            <span className={styles.statLabel}>como anfitrión</span>
          </div>
          <div className={styles.statChip}>
            <span className={styles.statNumber}>{asPlayer}</span>
            <span className={styles.statLabel}>como jugador</span>
          </div>
          <div className={styles.statChip}>
            <span className={styles.statNumber}>{upcomingCount}</span>
            <span className={styles.statLabel}>próximas</span>
          </div>
        </div>

        {!loading && !error && nextGame && filter === 'all' && (
          <NextGameHighlight table={nextGame} userId={uid} />
        )}

        <div className={styles.filterBar}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`${styles.filterBtn} ${filter === f.key ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading && <p className={styles.loading}>Cargando historial…</p>}
        {error && <p className={styles.errorMsg}>{error}</p>}

        {!loading && !error && filteredTables.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🎲</span>
            <p>No hay mesas para mostrar.</p>
            <Link to="/" className={styles.emptyLink}>Explorar mesas disponibles</Link>
          </div>
        )}

        {!loading && !error && filteredTables.length > 0 && (
          <div className={styles.feed}>
            {upcoming.map((t) => (
              <FeedCard key={t._id} table={t} userId={uid} isPast={false} />
            ))}

            <div className={styles.separator}>
              <span className={styles.separatorLine} />
              <span className={styles.separatorLabel}>↑ Próximas · Historial ↓</span>
              <span className={styles.separatorLine} />
            </div>

            {past.map((t) => (
              <FeedCard key={t._id} table={t} userId={uid} isPast={true} />
            ))}

            {past.length === 0 && (
              <p className={styles.sectionEmpty}>Sin mesas jugadas todavía.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
