import Meeple from "../../components/shared/Meeple";
import { useCallback, useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "../../api/endpoints";
import Avatar from "../../components/shared/Avatar";
import EmptyState from "../../components/shared/EmptyState";
import useInfiniteScroll from "../../hooks/useInfiniteScroll";
import { getUserDisplay } from "../../utils/userDisplay";
import { useBrandName } from "../../hooks/useBrandName";
import { CommunityContext } from "../../context/CommunityContext";
import styles from "./BgWatchComunidad.module.css";

const TABS = [
  { key: "juegos", label: "Juegos" },
  { key: "jugadores", label: "Jugadores" },
  { key: "actividad", label: "Actividad" },
];

// ─── Tab: Juegos ──────────────────────────────────────────────────────────
function JuegosTab() {
  const [periodo, setPeriodo] = useState("all");
  const [games, setGames] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    setGames(null);
    setError(false);
    axios
      .get(API.bgg.COMUNIDAD_JUEGOS, {
        params: { periodo },
        signal: ac.signal,
      })
      .then(({ data }) => setGames(data.games || []))
      .catch((err) => {
        if (!axios.isCancel(err)) setError(true);
      });
    return () => ac.abort();
  }, [periodo]);

  return (
    <div className={styles.tabBody}>
      <div
        className={styles.periodToggle}
        role="radiogroup"
        aria-label="Período"
      >
        <button
          type="button"
          role="radio"
          aria-checked={periodo === "all"}
          className={`${styles.pill} ${periodo === "all" ? styles.pillOn : ""}`}
          onClick={() => setPeriodo("all")}
        >
          Más jugados
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={periodo === "mes"}
          className={`${styles.pill} ${periodo === "mes" ? styles.pillOn : ""}`}
          onClick={() => setPeriodo("mes")}
        >
          En llamas 🔥
        </button>
      </div>

      {error && (
        <p className={styles.errorMsg}>No se pudieron cargar los juegos.</p>
      )}

      {games && games.length === 0 && !error && (
        <EmptyState
          variant="first"
          eyebrow="SIN DATOS"
          title="Todavía no hay partidas en la comunidad"
          text="Cuando los miembros registren partidas, vas a ver acá los juegos más jugados."
        />
      )}

      {games && games.length > 0 && (
        <div className={styles.gameGrid}>
          {games.map((g, i) => (
            <Link
              key={g.id}
              to={`/bg-watch/comunidad/juego/${g.id}`}
              className={styles.gameCard}
            >
              <span className={styles.gameRank}>#{i + 1}</span>
              <div className={styles.gameThumb}>
                {g.image || g.thumbnail ? (
                  <img
                    src={g.image || g.thumbnail}
                    alt={g.name || ""}
                    loading="lazy"
                  />
                ) : (
                  <span className={styles.gameThumbFallback}>?</span>
                )}
              </div>
              <div className={styles.gameInfo}>
                <span className={styles.gameName}>
                  {g.name || `Juego ${g.id}`}
                </span>
                <span className={styles.gameMeta}>
                  {g.totalPlays} {g.totalPlays === 1 ? "partida" : "partidas"} ·{" "}
                  {g.playerCount}{" "}
                  {g.playerCount === 1 ? "jugador" : "jugadores"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {games === null && !error && (
        <div className={styles.loading}>Cargando…</div>
      )}
    </div>
  );
}

// ─── Tab: Jugadores ───────────────────────────────────────────────────────
const METRICS = [
  { key: "plays", label: "Partidas" },
  { key: "variedad", label: "Variedad" },
  { key: "winrate", label: "Win-rate" },
  { key: "racha", label: "Racha" },
];

function metricValue(metric, p) {
  if (metric === "variedad") return `${p.uniqueGames} juegos`;
  if (metric === "winrate") return `${Math.round(p.winRate * 100)}%`;
  if (metric === "racha") return `${p.weekStreak} sem`;
  return `${p.totalPlays} partidas`;
}

function JugadoresTab() {
  const [metric, setMetric] = useState("plays");
  const [players, setPlayers] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    setPlayers(null);
    setError(false);
    axios
      .get(API.bgg.COMUNIDAD_JUGADORES, {
        params: { metric },
        signal: ac.signal,
      })
      .then(({ data }) => setPlayers(data.players || []))
      .catch((err) => {
        if (!axios.isCancel(err)) setError(true);
      });
    return () => ac.abort();
  }, [metric]);

  return (
    <div className={styles.tabBody}>
      <div
        className={styles.metricToggle}
        role="radiogroup"
        aria-label="Métrica"
      >
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={metric === m.key}
            className={`${styles.pill} ${metric === m.key ? styles.pillOn : ""}`}
            onClick={() => setMetric(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {error && (
        <p className={styles.errorMsg}>No se pudo cargar el ranking.</p>
      )}

      {players && players.length === 0 && !error && (
        <EmptyState
          variant="first"
          eyebrow="SIN DATOS"
          title="Ranking vacío"
          text="No hay suficientes partidas registradas para armar este ranking todavía."
        />
      )}

      {players && players.length > 0 && (
        <ol className={styles.leaderboard}>
          {players.map((p, i) => {
            const display = getUserDisplay(p.user);
            const name = p.user ? display.name : p.bggUsername;
            const row = (
              <>
                <span className={styles.lbRank}>{i + 1}</span>
                {p.user ? (
                  <Avatar user={p.user} size="sm" />
                ) : (
                  <span className={styles.lbDot} aria-hidden="true" />
                )}
                <span className={styles.lbName}>{name}</span>
                <span className={styles.lbValue}>{metricValue(metric, p)}</span>
              </>
            );
            return (
              <li key={p.bggUsername} className={styles.lbRow}>
                <Link
                  to={`/bg-watch/${encodeURIComponent(p.bggUsername)}`}
                  className={styles.lbLink}
                >
                  {row}
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {players === null && !error && (
        <div className={styles.loading}>Cargando…</div>
      )}
    </div>
  );
}

// ─── Heatmap (días con actividad, último año) ─────────────────────────────
function HeatmapStrip() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const ac = new AbortController();
    axios
      .get(API.bgg.COMUNIDAD_HEATMAP, { signal: ac.signal })
      .then(({ data: d }) => setData(d.heatmap || []))
      .catch((err) => {
        if (!axios.isCancel(err)) setData([]);
      });
    return () => ac.abort();
  }, []);

  if (!data || data.length === 0) return null;

  const max = data.reduce((m, d) => Math.max(m, d.count), 0) || 1;
  return (
    <div className={styles.heatmap} aria-label="Actividad por día">
      {data.map((d) => {
        // 1..4 niveles de intensidad para el color.
        const level = Math.min(4, Math.ceil((d.count / max) * 4)) || 1;
        return (
          <span
            key={d.date}
            className={styles.heatCell}
            data-level={level}
            title={`${d.date}: ${d.count} ${d.count === 1 ? "partida" : "partidas"}`}
          />
        );
      })}
    </div>
  );
}

// ─── Tab: Actividad ───────────────────────────────────────────────────────
function ActividadTab() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback((p) => {
    setLoading(true);
    const ac = new AbortController();
    axios
      .get(API.bgg.COMUNIDAD_ACTIVIDAD, {
        params: { page: p, limit: 20 },
        signal: ac.signal,
      })
      .then(({ data }) => {
        setItems((prev) => (p === 1 ? data.items : [...prev, ...data.items]));
        setPage(data.page);
        setPages(data.pages);
        setLoading(false);
      })
      .catch((err) => {
        if (!axios.isCancel(err)) {
          setError(true);
          setLoading(false);
        }
      });
    return ac;
  }, []);

  // Carga inicial de la página 1. Sin ref-guard: en StrictMode el primer
  // efecto se aborta en el cleanup y el segundo completa el fetch (un guard
  // persistente haría que el segundo montaje saltee la carga y quede colgado).
  useEffect(() => {
    const ac = load(1);
    return () => ac.abort();
  }, [load]);

  const onLoadMore = useCallback(() => {
    if (!loading && page < pages) load(page + 1);
  }, [loading, page, pages, load]);
  const sentinelRef = useInfiniteScroll(onLoadMore, { enabled: page < pages });

  if (error) {
    return <p className={styles.errorMsg}>No se pudo cargar la actividad.</p>;
  }

  if (!loading && items.length === 0) {
    return (
      <EmptyState
        variant="first"
        eyebrow="SIN DATOS"
        title="No hay actividad reciente"
        text="Cuando los miembros registren partidas, vas a verlas en este feed."
      />
    );
  }

  return (
    <div className={styles.tabBody}>
      <HeatmapStrip />
      <ul className={styles.feed}>
        {items.map((it) => {
          const loggerName = it.logger
            ? getUserDisplay(it.logger).name
            : it.bggUsername;
          return (
            <li key={`${it.bggUsername}-${it.id}`} className={styles.feedRow}>
              {it.logger ? (
                <Avatar user={it.logger} size="sm" />
              ) : (
                <span className={styles.lbDot} aria-hidden="true" />
              )}
              <div className={styles.feedBody}>
                <p className={styles.feedText}>
                  <strong>{loggerName}</strong> jugó{" "}
                  <button
                    type="button"
                    className={styles.feedGameLink}
                    onClick={() =>
                      navigate(`/bg-watch/comunidad/juego/${it.gameId}`)
                    }
                  >
                    {it.gameName || `Juego ${it.gameId}`}
                  </button>
                </p>
                <span className={styles.feedMeta}>
                  {it.date}
                  {it.location ? ` · ${it.location}` : ""}
                </span>
              </div>
              {it.gameThumbnail && (
                <img
                  className={styles.feedThumb}
                  src={it.gameThumbnail}
                  alt=""
                  loading="lazy"
                />
              )}
            </li>
          );
        })}
      </ul>
      {loading && <div className={styles.loading}>Cargando…</div>}
      {page < pages && <div ref={sentinelRef} className={styles.sentinel} />}
    </div>
  );
}

// ─── Cartelito de scope ────────────────────────────────────────────────────
function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// Aclara con qué comunidades estás mirando las stats. Como la base "TurnoCero"
// ES toda la comunidad (todos pertenecen), tenerla en el "ver juntas" = scope
// global; para acotar hay que dejar tildada solo una sub-comunidad. El hub se
// remonta al cambiar el `viewing` (routesKey en App.jsx), así que esto refleja
// la selección en vivo. Lee el contexto null-safe: si no hay provider (tests
// presentacionales) o hay una sola comunidad / subdominio tenant, no se muestra.
function ScopeBanner() {
  const ctx = useContext(CommunityContext);
  if (!ctx || !ctx.loaded) return null;

  const {
    effectiveViewing = [],
    communityById,
    memberships = [],
    isTenant,
  } = ctx;
  if (isTenant || memberships.length <= 1) return null;

  const selected = effectiveViewing
    .map((id) => communityById?.get(id))
    .filter(Boolean);
  if (!selected.length) return null;

  const includesBase = selected.some((c) => c.isBase);

  return (
    <div
      className={styles.scopeBanner}
      data-scope={includesBase ? "global" : "scoped"}
    >
      <EyeIcon />
      {includesBase ? (
        <p className={styles.scopeText}>
          Estás viendo <strong>toda la comunidad</strong>. Para acotar las
          estadísticas a una comunidad puntual, destildá <strong>TurnoCero</strong>{" "}
          en el selector y dejá solo esa.
        </p>
      ) : (
        <p className={styles.scopeText}>
          Estás viendo las estadísticas de{" "}
          <strong>{selected.map((c) => c.name).join(" + ")}</strong>.
        </p>
      )}
    </div>
  );
}

// ─── Hub ──────────────────────────────────────────────────────────────────
export default function BgWatchComunidad() {
  const [tab, setTab] = useState("juegos");
  const brandName = useBrandName();

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.hero}>
          <div className={styles.eyebrow}>
            <Meeple />
            BG WATCH · COMUNIDAD
          </div>
          <h1 className={styles.heroTitle}>La comunidad en juego</h1>
          <p className={styles.heroSub}>
            Lo más jugado, los rankings y la actividad de toda la comunidad de{" "}
            {brandName}, a partir de las partidas que registran sus miembros.
          </p>
        </header>

        <ScopeBanner />

        <nav className={styles.tabs} aria-label="Secciones">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "juegos" && <JuegosTab />}
        {tab === "jugadores" && <JugadoresTab />}
        {tab === "actividad" && <ActividadTab />}
      </div>
    </div>
  );
}
