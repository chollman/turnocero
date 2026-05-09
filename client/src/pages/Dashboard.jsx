import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import TableCard from '../components/TableCard';
import styles from './Dashboard.module.css';

const TABS = [
  { id: 'all', label: 'Todas las mesas' },
  { id: 'mine', label: 'Mis mesas' },
];

export default function Dashboard() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');

  const fetchTables = async () => {
    setLoading(true);
    setError('');
    try {
      const url = activeTab === 'mine' ? '/api/tables/mine' : '/api/tables';
      const { data } = await axios.get(url);
      setTables(data);
    } catch (err) {
      setError('Error al cargar las mesas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, [activeTab]);

  const handleUpdate = (updatedTable) => {
    setTables((prev) =>
      prev.map((t) => (t._id === updatedTable._id ? updatedTable : t))
    );
  };

  const handleCancel = (tableId) => {
    setTables((prev) => prev.filter((t) => t._id !== tableId));
  };

  const filtered = tables.filter((t) =>
    t.boardGame.toLowerCase().includes(search.toLowerCase()) ||
    t.host.username?.toLowerCase().includes(search.toLowerCase())
  );

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
                onClick={() => setActiveTab(tab.id)}
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
            onChange={(e) => setSearch(e.target.value)}
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
            <button className={styles.retryBtn} onClick={fetchTables}>
              Reintentar
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🃏</span>
            <p className={styles.emptyTitle}>
              {search ? 'Sin resultados para esa búsqueda' : 'No hay mesas disponibles'}
            </p>
            <p className={styles.emptySub}>
              {!search && '¡Sé el primero en crear una mesa!'}
            </p>
            {!search && (
              <Link to="/create" className={styles.createBtn}>
                + Crear mesa
              </Link>
            )}
          </div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((table) => (
              <TableCard
                key={table._id}
                table={table}
                onUpdate={handleUpdate}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
