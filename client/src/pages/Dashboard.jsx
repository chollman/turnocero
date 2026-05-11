import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import TableCard from '../components/TableCard';
import styles from './Dashboard.module.css';

const TABS = [
  { id: 'all', label: 'Todas las mesas' },
  { id: 'mine', label: 'Mis mesas' },
];

const DEBOUNCE_MS = 400;

export default function Dashboard() {
  const [tables, setTables] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refetchKey, setRefetchKey] = useState(0);
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
        {/* Hero */}
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>Mesas de juego</h1>
          <p className={styles.heroSub}>
            Encontrá una mesa o creá la tuya y convocá jugadores
          </p>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <div className={styles.tabs}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            className={styles.search}
            placeholder="Buscar juego o host…"
            value={search}
            onChange={handleSearchChange}
          />
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
              {!debouncedSearch && '¡Sé el primero en crear una mesa!'}
            </p>
            {!debouncedSearch && (
              <Link to="/create" className={styles.createBtn}>
                + Crear mesa
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className={styles.grid}>
              {tables.map((table) => (
                <TableCard
                  key={table._id}
                  table={table}
                  onUpdate={handleUpdate}
                  onCancel={handleCancel}
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
    </div>
  );
}
