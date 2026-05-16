import { useEffect, useState } from 'react';
import axios from 'axios';
import PlayCard from './PlayCard';
import Pagination from './Pagination';
import styles from './BggProfile.module.css';

const PLAYS_PAGE_SIZE = 10;

const FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'year', label: 'Este año' },
  { id: 'month', label: 'Este mes' },
  { id: '7d', label: '7 días' },
];

function toIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateRangeFor(filterId) {
  if (filterId === 'all') return {};
  const now = new Date();
  if (filterId === 'year') {
    return { mindate: `${now.getFullYear()}-01-01` };
  }
  if (filterId === 'month') {
    return { mindate: toIso(new Date(now.getFullYear(), now.getMonth(), 1)) };
  }
  if (filterId === '7d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { mindate: toIso(d) };
  }
  return {};
}

export default function PartidasPanel({ bggUsername, onPlayClick, onMetaChange }) {
  const [plays, setPlays] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ page: String(page) });
    const range = dateRangeFor(filter);
    if (range.mindate) params.set('mindate', range.mindate);
    if (range.maxdate) params.set('maxdate', range.maxdate);

    axios.get(`/api/bgg/partidas/${encodeURIComponent(bggUsername)}?${params.toString()}`)
      .then(({ data }) => {
        if (cancelled) return;
        setPlays(data);
        // Only update parent meta on the unfiltered, page-1 fetch (StatsBar shows
        // all-time stats, not filtered)
        if (filter === 'all' && page === 1 && onMetaChange) {
          onMetaChange({
            total: data.total,
            lastDate: data.plays?.[0]?.date || null,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'No se pudo cargar las partidas');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [bggUsername, page, filter, onMetaChange]);

  const handleFilter = (id) => {
    if (id === filter) return;
    setFilter(id);
    setPage(1);
  };

  const handlePage = (p) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = plays ? Math.ceil(plays.total / PLAYS_PAGE_SIZE) : 0;

  return (
    <div className={styles.tabContent}>
      <div className={styles.filterBar}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`${styles.filterChip} ${filter === f.id ? styles.filterChipActive : ''}`}
            onClick={() => handleFilter(f.id)}
            type="button"
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className={styles.stateCenter}>
          <span className={styles.loadingDice}>🎲</span>
          <p>Cargando partidas…</p>
        </div>
      )}

      {error && (
        <div className={styles.stateCenter}>
          <p className={styles.errorText}>{error}</p>
        </div>
      )}

      {!loading && !error && plays && plays.plays.length === 0 && (
        <div className={styles.stateCenter}>
          <p>
            {filter === 'all'
              ? 'Este usuario no tiene partidas registradas en BGG.'
              : 'No hay partidas en el período seleccionado.'}
          </p>
        </div>
      )}

      {!loading && plays && plays.plays.length > 0 && (
        <div className={styles.playsList}>
          <div className={styles.playsHeader}>
            <span className={styles.playsTotal}>
              {plays.total} partida{plays.total === 1 ? '' : 's'}
              {filter !== 'all' && ' en el período'}
            </span>
            <span className={styles.paginationInfo}>
              página {page} de {totalPages}
            </span>
          </div>
          {plays.plays.map((play) => (
            <PlayCard
              key={play.id}
              play={play}
              onClick={() => onPlayClick(play)}
            />
          ))}
          <Pagination page={page} totalPages={totalPages} onPage={handlePage} />
        </div>
      )}
    </div>
  );
}
