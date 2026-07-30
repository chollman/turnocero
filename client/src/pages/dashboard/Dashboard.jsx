import Meeple from "../../components/shared/Meeple";
import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { useTablesQuery, tableKeys } from "../../queries/tables";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import useLocalStorageState from "../../utils/useLocalStorageState";
import { formatDate } from "../../utils/locale";
import { groupByHorizon } from "../../utils/mesaHorizon";
import ListFilters from "../../components/shared/ListFilters";
import EmptyState from "../../components/shared/EmptyState";
import { ArtMesa, ArtSearch } from "../../components/shared/EmptyArt";
import { GhostMesa } from "../../components/shared/EmptyGhosts";
import TableCard from "./TableCard";
import TableCardSkeleton from "./TableCardSkeleton";
import styles from "./Dashboard.module.css";

// Filtros: mismo shape que `<ListFilters>` consume (value/label, opcional
// `requiresAuth`). Para los que sí cambian la query al server (mine/host/
// joined) usamos los handlers debajo; los demás (`open`, `public`) filtran
// in-memory para evitar round-trips por una decisión visual.
// `value` se persiste en localStorage y alimenta los predicados — NO traducir.
function buildAllFilters(t) {
  return [
    { value: "all", label: t("dashboard:list.filters.all") },
    {
      value: "mine",
      label: t("dashboard:list.filters.mine"),
      requiresAuth: true,
    },
    {
      value: "host",
      label: t("dashboard:list.filters.host"),
      requiresAuth: true,
    },
    {
      value: "joined",
      label: t("dashboard:list.filters.joined"),
      requiresAuth: true,
    },
    { value: "open", label: t("dashboard:list.filters.open") },
    { value: "public", label: t("dashboard:list.filters.public") },
  ];
}

// Valores de filtro que requieren auth — antes derivado de ALL_FILTERS, ahora
// estático para que el reset de localStorage no dependa del idioma.
const AUTH_FILTERS = ["mine", "host", "joined"];

const MAX_RADIUS_KM = 100;

// Referencia estable — evita crear un array nuevo en cada render mientras la
// query no tiene datos, lo que invalidaría los useMemo río abajo.
const EMPTY_TABLES = [];

const GridIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="currentColor"
    aria-hidden="true"
  >
    <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" />
  </svg>
);

const ListIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="currentColor"
    aria-hidden="true"
  >
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
      // Solo mesas abiertas a cualquiera (excluye privadas y de amigos).
      return (t) => (t.privacy || "public") === "public";
    case "all":
    default:
      return () => true;
  }
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const allFilters = useMemo(() => buildAllFilters(t), [t]);
  const hasDireccion = Boolean(user?.direccion?.lat && user?.direccion?.lng);
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
  const [viewMode, setViewMode] = useLocalStorageState(
    "turnocero_mesas_view",
    "grid",
  );

  // Si el filter guardado en localStorage requiere auth y el user no está
  // logueado (anon o session expiró), volver a "all". Evita estados raros
  // tipo "Mis mesas" para anon.
  useEffect(() => {
    if (AUTH_FILTERS.includes(filter) && !user) setFilter("all");
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
  const effectiveRadiusKm = hasDireccion ? debouncedRadius : 0;
  // No tiene sentido pegarle a /mine sin auth.
  const skipQuery = useMineEndpoint && !user;
  const currentListKey = useMemo(
    () =>
      tableKeys.list({
        endpoint: useMineEndpoint ? "mine" : "list",
        page,
        search: debouncedSearch || "",
        radiusKm: effectiveRadiusKm || 0,
      }),
    [useMineEndpoint, page, debouncedSearch, effectiveRadiusKm],
  );

  const {
    data: tablesData,
    isPending,
    error: queryError,
    refetch,
  } = useTablesQuery({
    useMineEndpoint,
    page,
    search: debouncedSearch,
    radiusKm: effectiveRadiusKm,
    enabled: !skipQuery,
  });

  const tables = useMemo(
    () => (skipQuery ? EMPTY_TABLES : (tablesData?.tables ?? EMPTY_TABLES)),
    [tablesData, skipQuery],
  );
  const pagination = useMemo(
    () => ({
      page: tablesData?.page ?? 1,
      pages: tablesData?.pages ?? 1,
      total: tablesData?.total ?? 0,
      // /api/tables/mine no devuelve upcomingTotal (es otro endpoint que
      // no filtra por fecha) — fallback al `total` que sí trae.
      upcomingTotal: tablesData?.upcomingTotal ?? tablesData?.total ?? 0,
    }),
    [tablesData],
  );
  const loading = skipQuery ? false : isPending;
  const error = queryError ? t("dashboard:list.loadError") : "";

  const handleUpdate = (updatedTable) => {
    queryClient.setQueryData(currentListKey, (prev) =>
      prev
        ? {
            ...prev,
            tables: prev.tables.map((tbl) =>
              tbl._id === updatedTable._id ? updatedTable : tbl,
            ),
          }
        : prev,
    );
  };

  const handleCancel = (tableId) => {
    queryClient.setQueryData(currentListKey, (prev) =>
      prev
        ? { ...prev, tables: prev.tables.filter((tbl) => tbl._id !== tableId) }
        : prev,
    );
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

  // ¿El vacío viene de una búsqueda/filtro activo, o de no haber mesas?
  const isFiltered = Boolean(debouncedSearch) || filter !== "all";
  const clearFilters = () => {
    setSearch("");
    setFilter("all");
    setRadiusKm(0);
  };
  // Chips data-driven: contamos sobre la página cargada cuántas mesas
  // satisfacen los predicados client-side (con lugar / públicas). Sólo
  // ofrecemos los que tienen resultados reales y no son el filtro activo.
  const filterChips = useMemo(() => {
    const chips = [];
    const openCount = tables.filter(buildPredicate("open", user)).length;
    const publicCount = tables.filter(buildPredicate("public", user)).length;
    if (filter !== "open" && openCount > 0)
      chips.push({
        label: t("dashboard:list.chipOpen"),
        count: openCount,
        onClick: () => {
          setSearch("");
          setFilter("open");
        },
      });
    if (filter !== "public" && publicCount > 0)
      chips.push({
        label: t("dashboard:list.chipPublic"),
        count: publicCount,
        onClick: () => {
          setSearch("");
          setFilter("public");
        },
      });
    return chips;
  }, [tables, filter, user, setFilter, t]);

  // Mesas "activas" = sólo las futuras. El server expone `upcomingTotal`
  // contado aparte; el `total` general incluye históricas (que viven en
  // el grupo "Pasadas" pero no son capacidad para sumarse).
  const activeCount = pagination.upcomingTotal;
  const totalLabel =
    activeCount > 0
      ? t("dashboard:list.eyebrowActive", { count: activeCount })
      : t("dashboard:list.eyebrowFallback");

  const todayLabel = formatDate(new Date(), {
    day: "numeric",
    month: "long",
  });

  return (
    <div className={styles.page}>
      {/* Hero editorial */}
      <header className={styles.hero}>
        <div className={styles.heroLeft}>
          <p className={styles.heroEyebrow}>
            <Meeple />{totalLabel} · {todayLabel}
          </p>
          <h1 className={styles.heroTitle}>
            <Trans i18nKey="dashboard:list.heroTitle" components={{ em: <em /> }} />
          </h1>
          <p className={styles.heroSub}>{t("dashboard:list.heroSub")}</p>
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
            placeholder={t("dashboard:list.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t("dashboard:list.searchAria")}
          />
        </div>

        <div className={styles.controlsRight}>
          <ListFilters
            chips={allFilters}
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
            aria-label={t("dashboard:list.viewAria")}
          >
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === "grid" ? styles.viewBtnActive : ""}`}
              onClick={() => setViewMode("grid")}
              title={t("dashboard:list.viewGrid")}
              aria-pressed={viewMode === "grid"}
            >
              <GridIcon />
            </button>
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === "list" ? styles.viewBtnActive : ""}`}
              onClick={() => setViewMode("list")}
              title={t("dashboard:list.viewList")}
              aria-pressed={viewMode === "list"}
            >
              <ListIcon />
            </button>
          </div>
          {user && (
            <Link to="/mesas/crear" className={styles.newBtn}>
              <span aria-hidden="true">+</span> {t("dashboard:list.createMesa")}
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
            onClick={() => refetch()}
          >
            {t("dashboard:list.retry")}
          </button>
        </div>
      ) : filteredTables.length === 0 ? (
        isFiltered ? (
          <EmptyState
            variant="filtered"
            compact
            art={<ArtSearch />}
            eyebrow={t("dashboard:list.emptyFilteredEyebrow")}
            title={
              <Trans
                i18nKey="dashboard:list.emptyFilteredTitle"
                components={{ em: <em /> }}
              />
            }
            text={t("dashboard:list.emptyFilteredText")}
            chips={filterChips}
            secondary={{
              label: t("dashboard:list.clearFilters"),
              icon: "clear",
              onClick: clearFilters,
            }}
          />
        ) : (
          <EmptyState
            art={<ArtMesa />}
            ghost={<GhostMesa />}
            eyebrow={t("dashboard:list.emptyEyebrow")}
            title={
              <Trans
                i18nKey="dashboard:list.emptyTitle"
                components={{ em: <em /> }}
              />
            }
            text={
              user
                ? t("dashboard:list.emptyTextAuthed")
                : t("dashboard:list.emptyTextAnon")
            }
            primary={
              user
                ? {
                    label: t("dashboard:list.emptyCreateFirst"),
                    to: "/mesas/crear",
                  }
                : { label: t("dashboard:list.emptyRegister"), to: "/register" }
            }
            hint={
              <span>
                <Trans
                  i18nKey="dashboard:list.emptyHint"
                  components={{ strong: <strong /> }}
                />
              </span>
            }
          />
        )
      ) : (
        <>
          {horizonGroups.map((g) => (
            <section key={g.key} className={styles.horizon}>
              <header className={styles.horizonHead}>
                <span className={styles.horizonLabel}>
                  {t("dashboard:list.horizonLabel")}
                </span>
                <span
                  className={`${styles.horizonName} ${g.key === "today" ? styles.horizonNameToday : ""}`}
                >
                  {g.name}
                </span>
                <span className={styles.horizonSub}>{g.sub}</span>
                <span className={styles.horizonRule} aria-hidden="true" />
                <span className={styles.horizonCount}>
                  {(() => {
                    // Para "past" mostramos el total real de la consulta (no
                    // sólo lo visible en esta página). El server pagina por
                    // fecha DESC, así que las mesas pasadas suelen aparecer
                    // distribuidas en varias páginas — un count per-page
                    // engaña al user. `total - upcomingTotal` = pasadas
                    // totales en el filtro actual.
                    const count =
                      g.key === "past"
                        ? Math.max(
                            0,
                            pagination.total - pagination.upcomingTotal,
                          )
                        : g.items.length;
                    return t("dashboard:list.horizonCount", { count });
                  })()}
                </span>
              </header>
              <div className={viewMode === "list" ? styles.list : styles.grid}>
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
                {t("dashboard:list.prev")}
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
                {t("dashboard:list.next")}
              </button>
            </div>
          )}
        </>
      )}

      {/* FAB — mobile only, logged-in users only */}
      {user && (
        <Link
          to="/mesas/crear"
          className={styles.fab}
          aria-label={t("dashboard:list.createMesaAria")}
        >
          <span aria-hidden="true">+</span> {t("dashboard:list.createMesa")}
        </Link>
      )}
    </div>
  );
}
