import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API } from "../../api/endpoints";
import PlayCard from "./PlayCard";
import PlayCardSkeleton from "./PlayCardSkeleton";
import GameCardSkeleton from "./GameCardSkeleton";
import Pagination from "./Pagination";
import useBggUserMap from "./useBggUserMap";
import styles from "./BgWatchProfile.module.css";

const PLAYS_PAGE_SIZE = 10;
const GAMES_PAGE_SIZE = 24;

const FILTERS = [
  { id: "all", label: "Todas" },
  { id: "year", label: "Este año" },
  { id: "month", label: "Este mes" },
  { id: "7d", label: "7 días" },
];

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

function GameWithPlaysCard({ game, bggUsername, index = 0 }) {
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
              {game.numPlays === 1 ? "partida" : "partidas"}
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
  onMetaChange,
  canRefresh = false,
}) {
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'byGame'

  // ── List mode state ──
  const [plays, setPlays] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [refreshTick, setRefreshTick] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const forceRefreshRef = useRef(false);

  // ── By-game mode state ──
  const [gamesPage, setGamesPage] = useState(1);
  const [playedGamesFromServer, setPlayedGamesFromServer] = useState(null);

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = { page };
    const range = dateRangeFor(filter);
    if (range.mindate) params.mindate = range.mindate;
    if (range.maxdate) params.maxdate = range.maxdate;
    if (forceRefreshRef.current) {
      params.refresh = 1;
      forceRefreshRef.current = false;
    }

    axios
      .get(API.bgg.PARTIDAS(bggUsername), { params })
      .then(({ data, headers }) => {
        if (cancelled) return;
        setPlays(data);
        // Server is the source of truth for the cooldown — sync from header.
        const headerMs = Number(headers?.["x-refresh-cooldown-ms"] || 0);
        setCooldownUntil(headerMs > 0 ? Date.now() + headerMs : 0);
        setNow(Date.now());
        if (filter === "all" && page === 1 && onMetaChange) {
          onMetaChange({
            total: data.total,
            lastDate: data.plays?.[0]?.date || null,
            topGame: data.topGame ?? null,
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        // 429 carries the cooldown header too — sync the countdown.
        const headerMs = Number(
          err.response?.headers?.["x-refresh-cooldown-ms"] || 0,
        );
        if (headerMs > 0) {
          setCooldownUntil(Date.now() + headerMs);
          setNow(Date.now());
        }
        setError(
          err.response?.data?.message || "No se pudo cargar las partidas",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bggUsername, page, filter, onMetaChange, refreshTick]);

  // Fetch the server-aggregated played-games list (derived from BggPlay).
  // Authoritative when present: includes games the user played but doesn't
  // own, and works for users with private collections (where the
  // collection-derived list is empty/incomplete).
  useEffect(() => {
    let cancelled = false;
    axios
      .get(API.bgg.JUEGOS_JUGADOS(bggUsername))
      .then(({ data }) => {
        if (!cancelled) setPlayedGamesFromServer(data);
      })
      .catch(() => {
        if (!cancelled) setPlayedGamesFromServer([]);
      });
    return () => {
      cancelled = true;
    };
  }, [bggUsername, refreshTick]);

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

  // Map of bggUsernameLower → Turnocero user for any player on the current page
  // that's also a Turnocero member. Used by PlayCard to render avatar + link.
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
      <div className={styles.panelToolbar}>
        {viewMode === "list" && (
          <div className={styles.filterBar}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={`${styles.filterChip} ${filter === f.id ? styles.filterChipActive : ""}`}
                onClick={() => handleFilter(f.id)}
                type="button"
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        <div className={styles.viewToggle}>
          <button
            type="button"
            className={`${styles.viewToggleBtn} ${viewMode === "list" ? styles.viewToggleBtnActive : ""}`}
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
          >
            Lista
          </button>
          <button
            type="button"
            className={`${styles.viewToggleBtn} ${viewMode === "byGame" ? styles.viewToggleBtnActive : ""}`}
            onClick={() => setViewMode("byGame")}
            aria-pressed={viewMode === "byGame"}
          >
            Por juego
          </button>
        </div>
        {canRefresh && (
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => {
              if (loading || inCooldown) return;
              forceRefreshRef.current = true;
              setRefreshTick((t) => t + 1);
            }}
            disabled={loading || inCooldown}
            aria-label="Actualizar partidas"
          >
            ↻ {inCooldown ? `Esperá ${cooldownRemaining}s` : "Actualizar"}
          </button>
        )}
      </div>

      {viewMode === "list" && (
        <>
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
                  ? "Este usuario no tiene partidas registradas en BGG."
                  : "No hay partidas en el período seleccionado."}
              </p>
            </div>
          )}

          {!loading && plays && plays.plays.length > 0 && (
            <div className={styles.playsList}>
              <div className={styles.playsHeader}>
                <span className={styles.playsTotal}>
                  {plays.total} partida{plays.total === 1 ? "" : "s"}
                  {filter !== "all" && " en el período"}
                </span>
                <span className={styles.paginationInfo}>
                  página {page} de {totalPages}
                </span>
              </div>
              {plays.plays.map((play, i) => (
                <PlayCard
                  key={play.id}
                  play={play}
                  index={i}
                  userMap={userMap}
                  onClick={() => onPlayClick(play)}
                  onEdit={onPlayEdit ? () => onPlayEdit(play) : undefined}
                  onDelete={onPlayDelete ? () => onPlayDelete(play) : undefined}
                />
              ))}
              <Pagination
                page={page}
                totalPages={totalPages}
                onPage={handlePage}
              />
            </div>
          )}
        </>
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
              <p>No hay juegos con partidas registradas en la colección.</p>
            </div>
          )}

          {playedGames && playedGames.length > 0 && (
            <>
              <div className={styles.paginationHeader}>
                <span className={styles.paginationInfo}>
                  {playedGames.length} juego
                  {playedGames.length === 1 ? "" : "s"} · página {gamesPage} de{" "}
                  {gamesTotalPages}
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
