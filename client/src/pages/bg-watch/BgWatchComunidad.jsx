import Meeple from "../../components/shared/Meeple";
import { useCallback, useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import axios from "axios";
import { API } from "../../api/endpoints";
import Avatar from "../../components/shared/Avatar";
import EmptyState from "../../components/shared/EmptyState";
import useInfiniteScroll from "../../hooks/useInfiniteScroll";
import { getUserDisplay } from "../../utils/userDisplay";
import { useBrandName } from "../../hooks/useBrandName";
import { CommunityContext } from "../../context/CommunityContext";
import styles from "./BgWatchComunidad.module.css";

const TAB_KEYS = ["juegos", "jugadores", "actividad"];

// ─── Tab: Juegos ──────────────────────────────────────────────────────────
function JuegosTab() {
  const { t } = useTranslation("bgwatch");
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
        aria-label={t("comunidad.periodLabel")}
      >
        <button
          type="button"
          role="radio"
          aria-checked={periodo === "all"}
          className={`${styles.pill} ${periodo === "all" ? styles.pillOn : ""}`}
          onClick={() => setPeriodo("all")}
        >
          {t("comunidad.mostPlayed")}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={periodo === "mes"}
          className={`${styles.pill} ${periodo === "mes" ? styles.pillOn : ""}`}
          onClick={() => setPeriodo("mes")}
        >
          {t("comunidad.onFire")}
        </button>
      </div>

      {error && (
        <p className={styles.errorMsg}>{t("comunidad.gamesError")}</p>
      )}

      {games && games.length === 0 && !error && (
        <EmptyState
          variant="first"
          eyebrow={t("comunidad.noDataEyebrow")}
          title={t("comunidad.gamesEmptyTitle")}
          text={t("comunidad.gamesEmptyText")}
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
                  {g.name || t("comunidad.gameFallback", { id: g.id })}
                </span>
                <span className={styles.gameMeta}>
                  {t("comunidad.gameMeta", {
                    plays: t("comunidad.playsCount", { count: g.totalPlays }),
                    players: t("comunidad.playersCount", {
                      count: g.playerCount,
                    }),
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {games === null && !error && (
        <div className={styles.loading}>{t("common.loading")}</div>
      )}
    </div>
  );
}

// ─── Tab: Jugadores ───────────────────────────────────────────────────────
const METRIC_KEYS = ["plays", "variedad", "winrate", "racha"];

function metricValue(t, metric, p) {
  if (metric === "variedad")
    return t("comunidad.metricValue.variedad", { n: p.uniqueGames });
  if (metric === "winrate")
    return t("comunidad.metricValue.winrate", {
      n: Math.round(p.winRate * 100),
    });
  if (metric === "racha")
    return t("comunidad.metricValue.racha", { n: p.weekStreak });
  return t("comunidad.metricValue.plays", { n: p.totalPlays });
}

function JugadoresTab() {
  const { t } = useTranslation("bgwatch");
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
        aria-label={t("comunidad.metricLabel")}
      >
        {METRIC_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={metric === key}
            className={`${styles.pill} ${metric === key ? styles.pillOn : ""}`}
            onClick={() => setMetric(key)}
          >
            {t(`comunidad.metrics.${key}`)}
          </button>
        ))}
      </div>

      {error && (
        <p className={styles.errorMsg}>{t("comunidad.rankingError")}</p>
      )}

      {players && players.length === 0 && !error && (
        <EmptyState
          variant="first"
          eyebrow={t("comunidad.noDataEyebrow")}
          title={t("comunidad.rankingEmptyTitle")}
          text={t("comunidad.rankingEmptyText")}
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
                <span className={styles.lbValue}>
                  {metricValue(t, metric, p)}
                </span>
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
        <div className={styles.loading}>{t("common.loading")}</div>
      )}
    </div>
  );
}

// ─── Heatmap (días con actividad, último año) ─────────────────────────────
function HeatmapStrip() {
  const { t } = useTranslation("bgwatch");
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
    <div className={styles.heatmap} aria-label={t("comunidad.activityLabel")}>
      {data.map((d) => {
        // 1..4 niveles de intensidad para el color.
        const level = Math.min(4, Math.ceil((d.count / max) * 4)) || 1;
        return (
          <span
            key={d.date}
            className={styles.heatCell}
            data-level={level}
            title={t("comunidad.activityCell", {
              date: d.date,
              plays: t("comunidad.playsCount", { count: d.count }),
            })}
          />
        );
      })}
    </div>
  );
}

// ─── Tab: Actividad ───────────────────────────────────────────────────────
function ActividadTab() {
  const { t } = useTranslation("bgwatch");
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
    return <p className={styles.errorMsg}>{t("comunidad.activityError")}</p>;
  }

  if (!loading && items.length === 0) {
    return (
      <EmptyState
        variant="first"
        eyebrow={t("comunidad.noDataEyebrow")}
        title={t("comunidad.activityEmptyTitle")}
        text={t("comunidad.activityEmptyText")}
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
                  <strong>{loggerName}</strong> {t("comunidad.feedPlayed")}{" "}
                  <button
                    type="button"
                    className={styles.feedGameLink}
                    onClick={() =>
                      navigate(`/bg-watch/comunidad/juego/${it.gameId}`)
                    }
                  >
                    {it.gameName ||
                      t("comunidad.gameFallback", { id: it.gameId })}
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
      {loading && <div className={styles.loading}>{t("common.loading")}</div>}
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
  const { t } = useTranslation("bgwatch");
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
          <Trans
            t={t}
            i18nKey="comunidad.scope.global"
            components={{ strong: <strong /> }}
          />
        </p>
      ) : (
        <p className={styles.scopeText}>
          <Trans
            t={t}
            i18nKey="comunidad.scope.scoped"
            values={{ names: selected.map((c) => c.name).join(" + ") }}
            components={{ strong: <strong /> }}
          />
        </p>
      )}
    </div>
  );
}

// ─── Hub ──────────────────────────────────────────────────────────────────
export default function BgWatchComunidad() {
  const { t } = useTranslation("bgwatch");
  const [tab, setTab] = useState("juegos");
  const brandName = useBrandName();

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.hero}>
          <div className={styles.eyebrow}>
            <Meeple />
            {t("comunidad.brand")}
          </div>
          <h1 className={styles.heroTitle}>{t("comunidad.heroTitle")}</h1>
          <p className={styles.heroSub}>
            {t("comunidad.heroSub", { brandName })}
          </p>
        </header>

        <ScopeBanner />

        <nav className={styles.tabs} aria-label={t("comunidad.sectionsLabel")}>
          {TAB_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`${styles.tab} ${tab === key ? styles.tabActive : ""}`}
              onClick={() => setTab(key)}
            >
              {t(`comunidad.tabs.${key}`)}
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
