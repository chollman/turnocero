import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import TableCard from './TableCard';
import styles from './Dashboard.module.css';

const TABS = [
  { id: 'all', label: 'Todas las mesas' },
  { id: 'mine', label: 'Mis mesas' },
];

const DEBOUNCE_MS = 400;

const GridIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
    <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" />
  </svg>
);

const ListIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
    <rect x="1" y="2" width="13" height="2" rx="1" />
    <rect x="1" y="6.5" width="13" height="2" rx="1" />
    <rect x="1" y="11" width="13" height="2" rx="1" />
  </svg>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refetchKey, setRefetchKey] = useState(0);
  const [viewMode, setViewMode] = useState('grid');
  const debounceTimer = useRef(null);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const url = activeTab === 'mine' ? '/api/tables/mine' : '/api/tables';
        const params = { page, limit: 20 };
        if (debouncedSearch) params.search = debouncedSearch;
        const { data } = await axios.get(url, { params });
        if (!cancelled) {
          setTables(data.tables);
          setPagination({ page: data.page, pages: data.pages, total: data.total });
        }
      } catch {
        if (!cancelled) setError('Error al cargar las mesas');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [activeTab, page, debouncedSearch, refetchKey]);

  const handleTabChange = (id) => {
    if (id === activeTab) return;
    setActiveTab(id);
    setPage(1);
  };

  const handleUpdate = (updatedTable) => {
    setTables((prev) =>
      prev.map((t) => (t._id === updatedTable._id ? updatedTable : t))
    );
  };

  const handleCancel = (tableId) => {
    setTables((prev) => prev.filter((t) => t._id !== tableId));
  };

  return (
    <div className={styles.page}>
      <div className="container">
        {/* Mobile compact header (shown instead of hero on mobile) */}
        <div className={styles.mobileHeader}>
          <div>
            <p className={styles.heroEyebrow}>
              ◆ {pagination.total > 0 ? `${pagination.total} MESAS ACTIVAS` : 'MESAS DE JUEGO'}
            </p>
            <h1 className={styles.mobileTitle}>Tirá los dados.</h1>
          </div>
        </div>

        {/* Hero — desktop only */}
        <div className={styles.hero}>
          <div className={styles.heroDecor} aria-hidden="true">
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.3"/>
              <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.3"/>
              <circle cx="50" cy="50" r="20" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.5"/>
              <polygon points="50,10 60,40 90,40 65,60 75,90 50,72 25,90 35,60 10,40 40,40" fill="rgba(24,136,239,0.12)"/>
            </svg>
          </div>
          <div className={styles.heroContent}>
            <p className={styles.heroEyebrow}>
              ◆ {pagination.total > 0 ? `${pagination.total} MESAS ACTIVAS` : 'MESAS DE JUEGO'}
            </p>
            <h1 className={styles.heroTitle}>Tirá los dados.</h1>
            <p className={styles.heroSub}>
              Sumate a una mesa o convocá la tuya. Encontrá jugadores cerca y empezá la próxima partida.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <div className={styles.tabs}>
            {TABS.filter((tab) => user || tab.id !== 'mine').map((tab) => (
              <button
                key={tab.id}
                className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.controlsRight}>
            {user && (
              <Link to="/mesas/crear" className={styles.createCtaBtn}>+ Crear mesa</Link>
            )}
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.activeViewBtn : ''}`}
                onClick={() => setViewMode('grid')}
                title="Vista en cuadrícula"
              >
                <GridIcon />
              </button>
              <button
                className={`${styles.viewBtn} ${viewMode === 'list' ? styles.activeViewBtn : ''}`}
                onClick={() => setViewMode('list')}
                title="Vista en lista"
              >
                <ListIcon />
              </button>
            </div>
            <input
              type="text"
              className={styles.search}
              placeholder="Buscar juego o host…"
              value={search}
              onChange={handleSearchChange}
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className={styles.center}>
            <span className={styles.spinner}>🎲</span>
            <p>Cargando mesas…</p>
          </div>
        ) : error ? (
          <div className={styles.center}>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.retryBtn} onClick={() => setRefetchKey((k) => k + 1)}>
              Reintentar
            </button>
          </div>
        ) : tables.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🃏</span>
            <p className={styles.emptyTitle}>
              {debouncedSearch ? 'Sin resultados para esa búsqueda' : 'No hay mesas disponibles'}
            </p>
            <p className={styles.emptySub}>
              {!debouncedSearch && (user ? '¡Sé el primero en crear una mesa!' : '¡Registrate para crear la primera!')}
            </p>
            {!debouncedSearch && user && (
              <Link to="/mesas/crear" className={styles.createBtn}>
                + Crear mesa
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className={viewMode === 'list' ? styles.list : styles.grid}>
              {tables.map((table) => (
                <TableCard
                  key={table._id}
                  table={table}
                  onUpdate={handleUpdate}
                  onCancel={handleCancel}
                  listMode={viewMode === 'list'}
                />
              ))}
            </div>
            {pagination.pages > 1 && (
              <div className={styles.pagination}>
                <button
                  className={styles.pageBtn}
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                >
                  ← Anterior
                </button>
                <span className={styles.pageInfo}>
                  {page} / {pagination.pages}
                </span>
                <button
                  className={styles.pageBtn}
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page === pagination.pages}
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB — mobile only, logged-in users only */}
      {user && (
        <Link to="/mesas/crear" className={styles.fab}>
          <span>+</span> Crear mesa
        </Link>
      )}
    </div>
  );
}
