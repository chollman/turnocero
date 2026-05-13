import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import styles from './UsersList.module.css';

const SORT_OPTIONS = [
  { value: 'alpha', label: 'A–Z' },
  { value: 'activity', label: 'Más activos' },
  { value: 'date_desc', label: 'Más nuevos' },
  { value: 'date_asc', label: 'Más antiguos' },
];

function UserCard({ user }) {
  const navigate = useNavigate();
  const displayLabel = user.displayName || [user.nombre, user.apellido].filter(Boolean).join(' ') || user.username;
  const totalActivity = user.tablesHosted + user.tablesAsPlayer;
  const joined = new Date(user.createdAt).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });

  return (
    <button className={styles.card} onClick={() => navigate(`/usuarios/${user._id}`)}>
      <div className={styles.cardAvatar}>
        {user.username.charAt(0).toUpperCase()}
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardUsername}>@{user.username}</p>
        {displayLabel !== user.username && (
          <p className={styles.cardName}>{displayLabel}</p>
        )}
        <div className={styles.cardMeta}>
          {user.direccion?.texto && (
            <span className={styles.metaChip}>
              <span className={styles.metaIcon}>📍</span>
              {user.direccion.texto.length > 30 ? user.direccion.texto.slice(0, 30) + '…' : user.direccion.texto}
            </span>
          )}
          <span className={styles.metaChip}>
            <span className={styles.metaIcon}>📅</span>
            Desde {joined}
          </span>
        </div>
      </div>
      <div className={styles.cardStats}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{user.tablesHosted}</span>
          <span className={styles.statLabel}>Mesas creadas</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statValue}>{user.tablesAsPlayer}</span>
          <span className={styles.statLabel}>Mesas jugadas</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statValue}>{user.compartidas}</span>
          <span className={styles.statLabel}>Publicaciones</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={`${styles.statValue} ${totalActivity > 0 ? styles.statValueActive : ''}`}>
            {totalActivity}
          </span>
          <span className={styles.statLabel}>Total</span>
        </div>
      </div>
    </button>
  );
}

export default function UsersList() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('alpha');
  const [activeOnly, setActiveOnly] = useState(false);
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { sortBy };
      if (search) params.search = search;
      if (activeOnly) params.activeOnly = 'true';
      if (friendsOnly) params.friendsOnly = 'true';
      const { data } = await axios.get('/api/users', { params });
      setUsers(data);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [search, sortBy, activeOnly, friendsOnly]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Comunidad</h1>
          <p className={styles.subtitle}>Jugadores registrados en Turnocero</p>
        </div>
        <span className={styles.countBadge}>{users.length} jugador{users.length !== 1 ? 'es' : ''}</span>
      </div>

      <div className={styles.controls}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Buscar por usuario o nombre…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button className={styles.clearBtn} onClick={() => { setSearchInput(''); setSearch(''); }}>✕</button>
          )}
        </div>

        <div className={styles.filters}>
          <select
            className={styles.select}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <button
            className={`${styles.toggleBtn} ${activeOnly ? styles.toggleActive : ''}`}
            onClick={() => setActiveOnly((v) => !v)}
          >
            Solo activos
          </button>

          {currentUser && (
            <button
              className={`${styles.toggleBtn} ${friendsOnly ? styles.toggleActive : ''}`}
              onClick={() => setFriendsOnly((v) => !v)}
            >
              Solo amigos
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <span className={styles.loadingDice}>🎲</span>
          <p>Cargando jugadores…</p>
        </div>
      ) : users.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>👥</span>
          <p>No se encontraron jugadores</p>
          {(search || activeOnly) && (
            <button className={styles.clearFiltersBtn} onClick={() => { setSearchInput(''); setSearch(''); setActiveOnly(false); setFriendsOnly(false); }}>
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {users.map((u) => <UserCard key={u._id} user={u} />)}
        </div>
      )}
    </div>
  );
}
