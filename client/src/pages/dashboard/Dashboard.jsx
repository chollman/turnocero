import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { API } from "../../api/endpoints";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import useLocalStorageState from "../../utils/useLocalStorageState";
import { groupByHorizon } from "../../utils/mesaHorizon";
import ListFilters from "../../components/shared/ListFilters";
import TableCard from "./TableCard";
import TableCardSkeleton from "./TableCardSkeleton";
import styles from "./Dashboard.module.css";

// Filtros: mismo shape que `<ListFilters>` consume (value/label, opcional
// `requiresAuth`). Para los que sí cambian la query al server (mine/host/
// joined) usamos los handlers debajo; los demás (`open`, `public`) filtran
// in-memory para evitar round-trips por una decisión visual.
const ALL_FILTERS = [
  { value: "all", label: "Todas" },
  { value: "mine", label: "Mis mesas", requiresAuth: true },
  { value: "host", label: "Hosting", requiresAuth: true },
  { value: "joined", label: "Jugando", requiresAuth: true },
  { value: "open", label: "Con lugar" },
  { value: "public", label: "Públicas" },
];

const MAX_RADIUS_KM = 100;

const GridIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" aria-hidden="true">
    <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" />
  </svg>
);

const ListIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" aria-hidden="true">
    <rect x="1" y="2" width="13" height="2" rx="1" />
    <rect x="1" y="6.5" width="13" height="2" rx="1" />
    <rect x="1" y="11" width="13" height="2" rx="1" />
  </svg>
);

const SearchIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" />
    <line x1="20" y1="20" x2="16.65" y2="16.65" />
  </svg>
);

// Predicates por filtro: dado el user actual, devuelve la función que
// decide si una mesa pasa el filtro client-side.
function buildPredicate(filterId, user) {
  const uid = user?._id?.toString();
  switch (filterId) {
    case "mine":
      // El server ya devolvió "mis mesas" desde /api/tables/mine, así que
      // no filtramos client-side acá (sino, perdemos mesas donde sos
      // jugador-solamente con host populado a otro `_id`).
      return () => true;
    case "host":
      if (!uid) return () => true;
      return (t) => t.host?._id?.toString() === uid;
    case "joined":
      if (!uid) return () => true;
      return (t) =>
        (t.players || []).some((p) => (p._id || p).toString() === uid);
    case "open":
      return (t) => (t.players || []).length < (t.maxPlayers || 0);
    case "public":
      return (t) => t.privacy !== "private";
    case "all":
    default:
      return () => true;
  }
}

export default function Dashboard() {
  const { user } = useAuth();
  const hasDireccion = Boolean(user?.direccion?.lat && user?.direccion?.lng);
  const [tables, setTables] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Persistimos el filter en localStorage — alineado con Eventos. Si el chip
  // guardado deja de ser visible (logout con filter="mine"), un effect abajo
  // lo resetea a "all".
  const [filter, setFilter] = useLocalStorageState(
    "turnocero_mesas_filter",
    "all",
  );
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [radiusKm, setRadiusKm] = useState(0);
  const debouncedRadius = useDebouncedValue(radiusKm, 300);
  const [page, setPage] = useState(1);
  const [refetchKey, setRefetchKey] = useState(0);
  const [viewMode, setViewMode] = useLocalStorageState(
    "turnocero_mesas_view",
    "grid",
  );

  // Si el filter guardado en localStorage requiere auth y el user no está
  // logueado (anon o session expiró), volver a "all". Evita estados raros
  // tipo "Mis mesas" para anon.
  useEffect(() => {
    const def = ALL_FILTERS.find((f) => f.value === filter);
    if (def?.requiresAuth && !user) setFilter("all");
  }, [filter, user, setFilter]);

  // Resetear página al cambiar search, radio o filtro.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, debouncedRadius, filter]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  // Server-side endpoint depende del filtro:
  // - "mine"/"host"/"joined" usan /api/tables/mine (que ya devuelve hosting+joined)
  //   y refinamos client-side.
  // - El resto usan /api/tables.
  const useMineEndpoint = ["mine", "host", "joined"].includes(filter);

  useEffect(() => {
    if (useMineEndpoint && !user) {
      // No tiene sentido pegarle a /mine sin auth.
      setTables([]);
      setPagination({ page: 1, pages: 1, total: 0 });
      setLoading(false);
      return undefined;
    }
    const ac = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const url = useMineEndpoint ? API.tables.MINE : API.tables.LIST;
        const params = { page, limit: 12 };
        if (debouncedSearch) params.search = debouncedSearch;
        if (hasDireccion && debouncedRadius > 0)
          params.maxDistanceKm = debouncedRadius;
        const { data } = await axios.get(url, {
          params,
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        setTables(data.tables);
        setPagination({
          page: data.page,
          pages: data.pages,
          total: data.total,
        });
      } catch (err) {
        if (axios.isCancel(err)) return;
        setError("Error al cargar las mesas");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => ac.abort();
  }, [
    useMineEndpoint,
    user,
    page,
    debouncedSearch,
    debouncedRadius,
    hasDireccion,
    refetchKey,
  ]);

  const handleUpdate = (updatedTable) => {
    setTables((prev) =>
      prev.map((t) => (t._id === updatedTable._id ? updatedTable : t)),
    );
  };

  const handleCancel = (tableId) => {
    setTables((prev) => prev.filter((t) => t._id !== tableId));
  };

  // Aplicar filtro client-side (los filtros que no rompen pagination —
  // `open` / `public` filtran in-memory sobre la página actual). Para
  // `host` / `joined` el server ya filtró pero re-aplicamos por las dudas.
  const filteredTables = useMemo(() => {
    const pred = buildPredicate(filter, user);
    return tables.filter(pred);
  }, [tables, filter, user]);

  // Agrupar por horizonte temporal.
  const horizonGroups = useMemo(
    () => groupByHorizon(filteredTables, (t) => t.date),
    [filteredTables],
  );

  const totalLabel =
    pagination.total > 0
      ? `${pagination.total} mesa${pagination.total !== 1 ? "s" : ""} activa${pagination.total !== 1 ? "s" : ""}`
      : "Mesas de juego";

  const todayLabel = new Date().toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
  });

  return (
    <div className={styles.page}>
      <div className="container">
        {/* Hero editorial */}
        <header className={styles.hero}>
          <div className={styles.heroLeft}>
            <p className={styles.heroEyebrow}>
              ◆ {totalLabel} · {todayLabel}
            </p>
            <h1 className={styles.heroTitle}>
              Tirá los <em>dados.</em>
            </h1>
            <p className={styles.heroSub}>
              Sumate a una mesa o convocá la tuya. Encontrá jugadores cerca
              y empezá la próxima partida.
            </p>
          </div>
        </header>

        {/* Controls */}
        <div className={styles.controls}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>
              <SearchIcon />
            </span>
            <input
              type="text"
              className={styles.search}
              placeholder="Buscar juego o host…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar"
            />
          </div>

          <div className={styles.controlsRight}>
            <ListFilters
              chips={ALL_FILTERS}
              activeChip={filter}
              onChipChange={setFilter}
              defaultChip="all"
              isAdmin={!!user?.isAdmin}
              isAuthenticated={!!user}
              showDistance={!!user}
              radiusKm={radiusKm}
              onRadiusChange={setRadiusKm}
              hasDireccion={hasDireccion}
              maxRadiusKm={MAX_RADIUS_KM}
            />

            <div
              className={styles.viewToggle}
              role="group"
              aria-label="Vista"
            >
              <button
                type="button"
                className={`${styles.viewBtn} ${viewMode === "grid" ? styles.viewBtnActive : ""}`}
                onClick={() => setViewMode("grid")}
                title="Vista en cuadrícula"
                aria-pressed={viewMode === "grid"}
              >
                <GridIcon />
              </button>
              <button
                type="button"
                className={`${styles.viewBtn} ${viewMode === "list" ? styles.viewBtnActive : ""}`}
                onClick={() => setViewMode("list")}
                title="Vista en lista"
                aria-pressed={viewMode === "list"}
              >
                <ListIcon />
              </button>
            </div>
            {user && (
              <Link to="/mesas/crear" className={styles.newBtn}>
                <span aria-hidden="true">+</span> Crear mesa
              </Link>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className={styles.grid}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <TableCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className={styles.center}>
            <p className={styles.errorText}>{error}</p>
            <button
              type="button"
              className={styles.retryBtn}
              onClick={() => setRefetchKey((k) => k + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🃏</span>
            <p className={styles.emptyTitle}>
              {debouncedSearch
                ? "Sin resultados para esa búsqueda"
                : filter !== "all"
                  ? "Sin mesas para este filtro"
                  : "No hay mesas disponibles"}
            </p>
            <p className={styles.emptySub}>
              {!debouncedSearch &&
                (user
                  ? "¡Sé el primero en crear una mesa!"
                  : "¡Registrate para crear la primera!")}
            </p>
            {!debouncedSearch && user && (
              <Link to="/mesas/crear" className={styles.createBtn}>
                + Crear mesa
              </Link>
            )}
          </div>
        ) : (
          <>
            {horizonGroups.map((g) => (
              <section key={g.key} className={styles.horizon}>
                <header className={styles.horizonHead}>
                  <span className={styles.horizonLabel}>Horizonte</span>
                  <span
                    className={`${styles.horizonName} ${g.key === "today" ? styles.horizonNameToday : ""}`}
                  >
                    {g.name}
                  </span>
                  <span className={styles.horizonSub}>{g.sub}</span>
                  <span className={styles.horizonRule} aria-hidden="true" />
                  <span className={styles.horizonCount}>
                    {g.items.length} mesa{g.items.length !== 1 ? "s" : ""}
                  </span>
                </header>
                <div
                  className={
                    viewMode === "list" ? styles.list : styles.grid
                  }
                >
                  {g.items.map((table, i) => (
                    <div
                      key={table._id}
                      className={styles.cardSlot}
                      style={{ "--i": i }}
                    >
                      <TableCard
                        table={table}
                        onUpdate={handleUpdate}
                        onCancel={handleCancel}
                        listMode={viewMode === "list"}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {pagination.pages > 1 && (
              <div className={styles.pagination}>
                <button
                  type="button"
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
                  type="button"
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
        <Link to="/mesas/crear" className={styles.fab} aria-label="Crear mesa">
          <span aria-hidden="true">+</span> Crear mesa
        </Link>
      )}
    </div>
  );
}
