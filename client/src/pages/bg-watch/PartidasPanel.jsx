import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useBgWatchPartidasQuery,
  usePartidasCooldownQuery,
  refreshBgWatchPartidas,
  partidasQueryKey,
  useJuegosJugadosQuery,
  useResumenQuery,
  bgWatchKeys,
} from "../../queries/bgWatch";
import PlayCard from "./PlayCard";
import BgWatchFilterSelect from "./BgWatchFilterSelect";
import PlayCardSkeleton from "./PlayCardSkeleton";
import GameCardSkeleton from "./GameCardSkeleton";
import Pagination from "./Pagination";
import Heatmap from "./widgets/Heatmap";
import TopCollectionWidget from "./widgets/TopCollectionWidget";
import WinRateWidget from "./widgets/WinRateWidget";
import useBggUserMap from "./useBggUserMap";
import { formatExactDateTime } from "../../utils/time";
import styles from "./BgWatchProfile.module.css";

const PLAYS_PAGE_SIZE = 10;
const GAMES_PAGE_SIZE = 24;

const FILTER_IDS = ["all", "year", "month", "7d"];

function toIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateRangeFor(filterId) {
  if (filterId === "all") return {};
  const now = new Date();
  if (filterId === "year") {
    return { mindate: `${now.getFullYear()}-01-01` };
  }
  if (filterId === "month") {
    return { mindate: toIso(new Date(now.getFullYear(), now.getMonth(), 1)) };
  }
  if (filterId === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { mindate: toIso(d) };
  }
  return {};
}

// Íconos del handoff "BG Watch Mobile" (.playsBar): toggle lista/juego + sync.
function ViewListIcon() {
  return (
    <svg
      className={styles.viewToggleIcon}
      viewBox="0 0 15 15"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="1" y="2" width="13" height="2" rx="1" />
      <rect x="1" y="6.5" width="13" height="2" rx="1" />
      <rect x="1" y="11" width="13" height="2" rx="1" />
    </svg>
  );
}

function ViewGridIcon() {
  return (
    <svg
      className={styles.viewToggleIcon}
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
}

function SyncIcon() {
  return (
    <svg
      className={styles.refreshIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function GameWithPlaysCard({ game, bggUsername, index = 0 }) {
  const { t } = useTranslation("bgwatch");
  return (
    <Link
      to={`/bg-watch/${encodeURIComponent(bggUsername)}/juego/${game.id}`}
      className={styles.gameLink}
    >
      <div className={styles.gameCard} style={{ "--i": index }}>
        {game.thumbnail ? (
          <img
            src={game.thumbnail}
            alt={game.name}
            className={styles.gameThumbnail}
            loading="lazy"
          />
        ) : (
          <div className={styles.gameThumbnailPlaceholder}>🎲</div>
        )}
        <div className={styles.gameInfo}>
          <div className={styles.gameName}>{game.name}</div>
          {game.yearPublished && (
            <div className={styles.gameYear}>{game.yearPublished}</div>
          )}
          <div className={styles.gamePlayCount}>
            <span className={styles.gamePlayCountValue}>{game.numPlays}</span>
            <span className={styles.gamePlayCountLabel}>
              {t("partidas.gamePlaysCount", { count: game.numPlays })}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function PartidasPanel({
  bggUsername,
  collection,
  onPlayClick,
  onPlayEdit,
  onPlayDelete,
  onPlayLogAnother,
  onMetaChange,
  canRefresh = false,
}) {
  const { t } = useTranslation("bgwatch");
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'byGame'

  // ── List mode state ──
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [refreshError, setRefreshError] = useState(null);

  // ── By-game mode state ──
  const [gamesPage, setGamesPage] = useState(1);

  const range = dateRangeFor(filter);
  const {
    data: plays,
    isPending: loading,
    error: queryError,
  } = useBgWatchPartidasQuery({
    bggUsername,
    page,
    mindate: range.mindate,
    maxdate: range.maxdate,
  });
  const error = refreshError
    ? refreshError
    : queryError
      ? queryError.response?.data?.message || t("partidas.loadError")
      : null;

  useEffect(() => {
    if (plays && filter === "all" && page === 1) {
      onMetaChange?.({
        total: plays.total,
        lastDate: plays.plays?.[0]?.date || null,
        topGame: plays.topGame ?? null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plays, filter, page]);

  // Fetch the server-aggregated played-games list (derived from BggPlay).
  // Authoritative when present: includes games the user played but doesn't
  // own, and works for users with private collections (where the
  // collection-derived list is empty/incomplete).
  const { data: playedGamesFromServer } = useJuegosJugadosQuery(bggUsername);

  // ── Sidebar (modo lista) ── resumen agregado para heatmap + win-rate. Se
  // trae UNA vez por perfil (no por página/filtro): win-rate y heatmap salen
  // de la agregación COMPLETA del log, así que NO se deben recomputar del
  // page-sample. Falla en silencio (sidebar degradado, no rompe la lista).
  const { data: resumen } = useResumenQuery(bggUsername);

  // Server-driven cooldown: cada GET (no solo el refresh manual) devuelve el
  // header — sincronizado por useBgWatchPartidasQuery a un cache-entry propio.
  const { data: cooldownUntilFromServer } = usePartidasCooldownQuery(bggUsername);
  useEffect(() => {
    if (typeof cooldownUntilFromServer === "number") {
      setCooldownUntil(cooldownUntilFromServer);
      setNow(Date.now());
    }
  }, [cooldownUntilFromServer]);

  const cooldownRemaining = Math.max(
    0,
    Math.ceil((cooldownUntil - now) / 1000),
  );
  const inCooldown = cooldownRemaining > 0;

  useEffect(() => {
    if (!inCooldown) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [inCooldown]);

  // "Actualizar" manual: bypassea la cache del server (refresh:1), escribe el
  // resultado directo en la MISMA entrada de cache (misma key que la query de
  // lectura) y sincroniza el cooldown server-driven. juegosJugados/resumen se
  // invalidan también — son agregados independientes de página/filtro que
  // solo tiene sentido re-pedir en un refresh real, no en paginar/filtrar.
  const handleRefresh = async () => {
    if (loading || refreshBusy || inCooldown) return;
    setRefreshBusy(true);
    setRefreshError(null);
    try {
      const { data, cooldownMs } = await refreshBgWatchPartidas(bggUsername, {
        page,
        mindate: range.mindate,
        maxdate: range.maxdate,
      });
      queryClient.setQueryData(
        partidasQueryKey(bggUsername, { page, mindate: range.mindate, maxdate: range.maxdate }),
        data,
      );
      const until = cooldownMs > 0 ? Date.now() + cooldownMs : 0;
      queryClient.setQueryData(bgWatchKeys.partidasCooldown(bggUsername), until);
      if (cooldownMs > 0) {
        setCooldownUntil(until);
        setNow(Date.now());
      }
      queryClient.invalidateQueries({ queryKey: bgWatchKeys.juegosJugados(bggUsername) });
      queryClient.invalidateQueries({ queryKey: bgWatchKeys.resumen(bggUsername) });
    } catch (err) {
      const cooldownMs = err.cooldownMs || 0;
      if (cooldownMs > 0) {
        setCooldownUntil(Date.now() + cooldownMs);
        setNow(Date.now());
      }
      setRefreshError(err.response?.data?.message || t("partidas.loadError"));
    } finally {
      setRefreshBusy(false);
    }
  };

  // Prefer the server-aggregated list when it has data. Fall back to the
  // collection-derived list for users whose plays aren't synced into
  // BggPlay yet (the legacy XML-cache path) — that fallback is what was
  // shown before this change, with its caveats (owned games only, etc.).
  const playedGames = useMemo(() => {
    if (playedGamesFromServer && playedGamesFromServer.length > 0) {
      return playedGamesFromServer;
    }
    if (!collection) return null;
    return [...collection]
      .filter((g) => (g.numPlays || 0) > 0)
      .sort((a, b) => (b.numPlays || 0) - (a.numPlays || 0));
  }, [playedGamesFromServer, collection]);

  // Map of bggUsernameLower → TurnoCero user for any player on the current page
  // that's also a TurnoCero member. Used by PlayCard to render avatar + link.
  const userMap = useBggUserMap(plays?.plays);

  const handleFilter = (id) => {
    if (id === filter) return;
    setFilter(id);
    setPage(1);
  };

  const handlePage = (p) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGamesPage = (p) => {
    setGamesPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalPages = plays ? Math.ceil(plays.total / PLAYS_PAGE_SIZE) : 0;
  const gamesTotalPages = playedGames
    ? Math.ceil(playedGames.length / GAMES_PAGE_SIZE)
    : 0;
  const gamesSlice = playedGames
    ? playedGames.slice(
        (gamesPage - 1) * GAMES_PAGE_SIZE,
        gamesPage * GAMES_PAGE_SIZE,
      )
    : [];

  return (
    <div className={styles.tabContent}>
      {/* En mobile el heatmap va arriba del panel (bajo el dropdown de tabs);
          en desktop vive en el sidebar. CSS muestra uno solo por breakpoint. */}
      {viewMode === "list" && (
        <div className={styles.heatmapMobile}>
          <Heatmap heatmap={resumen?.heatmap} />
        </div>
      )}
      <div className={styles.panelToolbar}>
        {viewMode === "list" && (
          <>
            {/* Desktop: chips. Mobile: dropdown (mismo set de filtros) — la
                visibilidad la resuelve el CSS (.filterBar vs .filterSelect). */}
            <div
              className={styles.filterBar}
              role="group"
              aria-label={t("partidas.filterByDate")}
            >
              {FILTER_IDS.map((id) => (
                <button
                  key={id}
                  className={`${styles.filterChip} ${filter === id ? styles.filterChipActive : ""}`}
                  onClick={() => handleFilter(id)}
                  type="button"
                >
                  {t(`partidas.filters.${id}`)}
                </button>
              ))}
            </div>
            <BgWatchFilterSelect
              filters={FILTER_IDS.map((id) => ({
                id,
                label: t(`partidas.filters.${id}`),
              }))}
              activeId={filter}
              onSelect={handleFilter}
            />
          </>
        )}
        {/* Título "Partidas · N" — sólo mobile (en desktop lo da el playsHeader
            de la lista). Diseño .playsBar del handoff "BG Watch Mobile". */}
        <div className={styles.playsBarTitle}>
          <span className={styles.playsBarLabel}>
            {t("partidas.title")}
            {plays?.total != null && (
              <span className={styles.playsBarCount}> · {plays.total}</span>
            )}
          </span>
          <span className={styles.playsBarRule} />
        </div>
        <div className={styles.viewToggle}>
          <button
            type="button"
            className={`${styles.viewToggleBtn} ${viewMode === "list" ? styles.viewToggleBtnActive : ""}`}
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
          >
            <ViewListIcon /> {t("partidas.viewList")}
          </button>
          <button
            type="button"
            className={`${styles.viewToggleBtn} ${viewMode === "byGame" ? styles.viewToggleBtnActive : ""}`}
            onClick={() => setViewMode("byGame")}
            aria-pressed={viewMode === "byGame"}
            aria-label={t("partidas.byGameAria")}
          >
            <ViewGridIcon />
            <span className={styles.viewToggleFull}>
              {t("partidas.byGameFull")}
            </span>
            <span className={styles.viewToggleShort}>
              {t("partidas.byGameShort")}
            </span>
          </button>
        </div>
        {canRefresh && (
          <>
            {plays?.sync?.lastProbedAt && (
              <span className={styles.lastSynced}>
                {t("partidas.lastSynced", {
                  when: formatExactDateTime(plays.sync.lastProbedAt),
                })}
              </span>
            )}
            <button
              type="button"
              className={`${styles.refreshBtn} ${loading || refreshBusy ? styles.refreshBtnSpinning : ""}`}
              onClick={handleRefresh}
              disabled={loading || refreshBusy || inCooldown}
              aria-label={t("partidas.refreshAria")}
            >
              <SyncIcon />
              <span
                className={`${styles.refreshLabel} ${inCooldown ? styles.refreshLabelCooldown : ""}`}
              >
                {inCooldown
                  ? t("partidas.refreshWait", { n: cooldownRemaining })
                  : t("partidas.refresh")}
              </span>
            </button>
          </>
        )}
      </div>

      {viewMode === "list" && (
        <div className={styles.partidasLayout}>
          <div className={styles.playsMain}>
            {loading && (
              <div className={styles.playsList}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <PlayCardSkeleton key={i} />
                ))}
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
                  {filter === "all"
                    ? t("partidas.emptyAll")
                    : t("partidas.emptyPeriod")}
                </p>
              </div>
            )}

            {!loading && plays && plays.plays.length > 0 && (
              <div className={styles.playsList}>
                <div className={styles.playsHeader}>
                  <span className={styles.playsTotal}>
                    {t("partidas.playsTotal", { count: plays.total })}
                    {filter !== "all" && t("partidas.playsTotalPeriod")}
                  </span>
                  <span className={styles.paginationInfo}>
                    {t("partidas.pageInfo", { page, total: totalPages })}
                  </span>
                </div>
                {plays.plays.map((play, i) => (
                  <PlayCard
                    key={play.id}
                    play={play}
                    index={i}
                    userMap={userMap}
                    bggUsername={bggUsername}
                    onClick={() => onPlayClick(play)}
                    onEdit={onPlayEdit ? () => onPlayEdit(play) : undefined}
                    onDelete={
                      onPlayDelete ? () => onPlayDelete(play) : undefined
                    }
                    onLogAnother={
                      onPlayLogAnother
                        ? () => onPlayLogAnother(play)
                        : undefined
                    }
                  />
                ))}
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPage={handlePage}
                />
              </div>
            )}
          </div>

          <aside className={styles.playsSideCol}>
            <div className={styles.heatmapDesktop}>
              <Heatmap heatmap={resumen?.heatmap} />
            </div>
            <TopCollectionWidget
              games={playedGames || []}
              bggUsername={bggUsername}
            />
            <WinRateWidget
              wins={resumen?.overallStats?.totalWins || 0}
              rated={resumen?.overallStats?.totalRated || 0}
            />
          </aside>
        </div>
      )}

      {viewMode === "byGame" && (
        <>
          {!playedGames && (
            <div className={styles.gameGrid}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <GameCardSkeleton key={i} />
              ))}
            </div>
          )}

          {playedGames && playedGames.length === 0 && (
            <div className={styles.stateCenter}>
              <p>{t("partidas.byGameEmpty")}</p>
            </div>
          )}

          {playedGames && playedGames.length > 0 && (
            <>
              <div className={styles.paginationHeader}>
                <span className={styles.paginationInfo}>
                  {t("partidas.gamesCount", { count: playedGames.length })}
                  {t("partidas.gamesPageInfo", {
                    page: gamesPage,
                    total: gamesTotalPages,
                  })}
                </span>
              </div>
              <div className={styles.gameGrid}>
                {gamesSlice.map((game, i) => (
                  <GameWithPlaysCard
                    key={game.id}
                    game={game}
                    index={i}
                    bggUsername={bggUsername}
                  />
                ))}
              </div>
              <Pagination
                page={gamesPage}
                totalPages={gamesTotalPages}
                onPage={handleGamesPage}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
