import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import DatabaseSkeleton from './DatabaseSkeleton';
import styles from './DatabaseViewer.module.css';

function cellValue(val) {
  if (val === null || val === undefined) return <span className={styles.null}>null</span>;
  if (typeof val === 'boolean') return <span className={styles.bool}>{String(val)}</span>;
  if (typeof val === 'object') {
    const str = JSON.stringify(val);
    return <span className={styles.obj} title={str}>{str.length > 60 ? `${str.slice(0, 57)}…` : str}</span>;
  }
  return String(val);
}

function unionKeys(docs) {
  const seen = new Set();
  const keys = [];
  for (const doc of docs) {
    for (const k of Object.keys(doc)) {
      if (!seen.has(k)) { seen.add(k); keys.push(k); }
    }
  }
  return keys;
}

function DatabaseViewerInner() {
  const { user } = useAuth();
  const [collections, setCollections] = useState([]);
  const [activeCol, setActiveCol] = useState(null);
  const [docs, setDocs] = useState([]);
  const [columns, setColumns] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    axios.get('/api/admin/collections')
      .then(({ data }) => {
        setCollections(data);
        if (data.length > 0) setActiveCol(data[0]);
      })
      .catch(() => setError('No se pudieron cargar las colecciones'));
  }, []);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  useEffect(() => {
    if (!activeCol) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const params = { page, limit: 50 };
        if (debouncedSearch) params.search = debouncedSearch;
        const { data } = await axios.get(`/api/admin/collections/${activeCol}`, { params });
        if (cancelled) return;
        setDocs(data.docs);
        setPagination({ page: data.page, pages: data.pages, total: data.total });
        setColumns(unionKeys(data.docs));
      } catch {
        if (!cancelled) setError('Error al cargar los datos');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [activeCol, page, debouncedSearch]);

  const handleColChange = (name) => {
    if (name === activeCol) return;
    setActiveCol(name);
    setPage(1);
    setSearch('');
    setDocs([]);
    setColumns([]);
  };

  const handleToggleAdmin = async (doc) => {
    setToggling(doc._id);
    try {
      const { data } = await axios.patch(`/api/admin/users/${doc._id}/admin`);
      setDocs((prev) =>
        prev.map((d) => (d._id?.toString() === doc._id?.toString() ? { ...d, isAdmin: data.isAdmin } : d))
      );
    } catch {
      setError('No se pudo cambiar el rol de admin');
    } finally {
      setToggling(null);
    }
  };

  const isUsersCollection = activeCol === 'users';

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.hero}>
          <div className={styles.eyebrow}>◆ BASE DE DATOS</div>
          <h1 className={styles.title}>Base de datos</h1>
          <p className={styles.sub}>Explorador de colecciones de MongoDB</p>
        </div>

        {collections.length > 0 && (
          <div className={styles.tabs}>
            {collections.map((name) => (
              <button
                key={name}
                className={`${styles.tab} ${activeCol === name ? styles.activeTab : ''}`}
                onClick={() => handleColChange(name)}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {activeCol && (
          <div className={styles.searchBar}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Buscar en la colección…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>
            )}
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {loading ? (
          <DatabaseSkeleton />
        ) : !error && docs.length === 0 && activeCol ? (
          <div className={styles.center}>
            <p>{debouncedSearch ? `Sin resultados para "${debouncedSearch}"` : 'La colección está vacía'}</p>
          </div>
        ) : columns.length > 0 && (
          <>
            <p className={styles.meta}>
              {debouncedSearch
                ? `${pagination.total} resultado${pagination.total !== 1 ? 's' : ''} para "${debouncedSearch}" · página ${pagination.page}/${pagination.pages}`
                : `${pagination.total} documentos · página ${pagination.page}/${pagination.pages}`}
            </p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {columns.map((col) => <th key={col}>{col}</th>)}
                    {isUsersCollection && <th>Admin</th>}
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc, i) => (
                    <tr key={doc._id ?? i}>
                      {columns.map((col) => (
                        <td key={col}>{cellValue(doc[col])}</td>
                      ))}
                      {isUsersCollection && (
                        <td>
                          <button
                            className={`${styles.adminToggle} ${doc.isAdmin ? styles.adminOn : styles.adminOff}`}
                            onClick={() => handleToggleAdmin(doc)}
                            disabled={toggling === doc._id || doc._id?.toString() === user._id?.toString()}
                            title={doc._id?.toString() === user._id?.toString() ? 'No podés quitarte el admin a vos mismo' : ''}
                          >
                            {toggling === doc._id ? '…' : doc.isAdmin ? 'Admin ✓' : 'Admin'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
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
                <span className={styles.pageInfo}>{page} / {pagination.pages}</span>
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

export default function DatabaseViewer() {
  // intentionally use isActuallyAdmin (not user.isAdmin) so the page stays accessible
  // when an admin previews the site as a regular user.
  const { isActuallyAdmin } = useAuth();
  if (!isActuallyAdmin) return <Navigate to="/" replace />;
  return <DatabaseViewerInner />;
}
