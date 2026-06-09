import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API } from "../../api/endpoints";
import Pagination from "./Pagination";
import GameCardSkeleton from "./GameCardSkeleton";
import styles from "./BgWatchProfile.module.css";

const COLLECTION_PAGE_SIZE = 24;

function StarRating({ value }) {
  if (!value) return <span className={styles.ratingNull}>—</span>;
  return <span className={styles.rating}>{Number(value).toFixed(1)}</span>;
}

function GameCard({ game, index = 0, logPlayHref = null }) {
  return (
    <div className={styles.gameCard} style={{ "--i": index }}>
      <div className={styles.gameThumbWrap}>
        {game.image || game.thumbnail ? (
          <img
            src={game.image || game.thumbnail}
            alt={game.name}
            className={styles.gameThumbnail}
            loading="lazy"
          />
        ) : (
          <div className={styles.gameThumbnailPlaceholder}>🎲</div>
        )}
        <span
          className={`${styles.gameCardCount} ${(game.numPlays || 0) === 0 ? styles.gameCardCountZero : ""}`}
        >
          {(game.numPlays || 0) === 0 ? "Sin jugar" : `${game.numPlays}×`}
        </span>
      </div>
      <div className={styles.gameInfo}>
        <div className={styles.gameName}>{game.name}</div>
        {game.yearPublished && (
          <div className={styles.gameYear}>{game.yearPublished}</div>
        )}
        <div className={styles.gameRatings}>
          <span className={styles.ratingBlock}>
            <span className={styles.ratingLabel}>Tu nota</span>
            <StarRating value={game.userRating} />
          </span>
          <span className={styles.ratingBlock}>
            <span className={styles.ratingLabel}>BGG</span>
            <StarRating value={game.bggRating} />
          </span>
          {game.numPlays > 0 && (
            <span className={styles.ratingBlock}>
              <span className={styles.ratingLabel}>Partidas</span>
              <span className={styles.rating}>{game.numPlays}×</span>
            </span>
          )}
        </div>
        {logPlayHref && (
          <Link to={logPlayHref} className={styles.gamePlayBtn}>
            + Cargar partida
          </Link>
        )}
      </div>
    </div>
  );
}

export default function ColeccionPanel({
  bggUsername,
  onLoaded,
  canRefresh = false,
  canCreate = false,
}) {
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const forceRefreshRef = useRef(false);

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
    const params = forceRefreshRef.current ? { refresh: 1 } : undefined;
    forceRefreshRef.current = false;
    axios
      .get(API.bgg.COLECCION(bggUsername), { params })
      .then(({ data, headers }) => {
        if (cancelled) return;
        setCollection(data);
        // Server-driven cooldown — sync from header.
        const headerMs = Number(headers?.["x-refresh-cooldown-ms"] || 0);
        setCooldownUntil(headerMs > 0 ? Date.now() + headerMs : 0);
        setNow(Date.now());
        if (onLoaded) onLoaded(data);
      })
      .catch((err) => {
        if (cancelled) return;
        // 429 includes the cooldown header — sync the countdown.
        const headerMs = Number(
          err.response?.headers?.["x-refresh-cooldown-ms"] || 0,
        );
        if (headerMs > 0) {
          setCooldownUntil(Date.now() + headerMs);
          setNow(Date.now());
        }
        setError(
          err.response?.data?.message || "No se pudo cargar la colección",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bggUsername, onLoaded, refreshTick]);

  const totalPages = collection
    ? Math.ceil(collection.length / COLLECTION_PAGE_SIZE)
    : 0;
  const slice = collection
    ? collection.slice(
        (page - 1) * COLLECTION_PAGE_SIZE,
        page * COLLECTION_PAGE_SIZE,
      )
    : [];

  const handlePage = (p) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.panelToolbar}>
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
            aria-label="Actualizar colección"
            style={{ marginLeft: "auto" }}
          >
            ↻ {inCooldown ? `Esperá ${cooldownRemaining}s` : "Actualizar"}
          </button>
        )}
      </div>

      {loading && (
        <div className={styles.gameGrid}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <GameCardSkeleton key={i} />
          ))}
        </div>
      )}

      {error && (
        <div className={styles.stateCenter}>
          <p className={styles.errorText}>{error}</p>
        </div>
      )}

      {!loading && !error && collection && collection.length === 0 && (
        <div className={styles.stateCenter}>
          <p>Este usuario no tiene juegos marcados como propios en BGG.</p>
        </div>
      )}

      {!loading && collection && collection.length > 0 && (
        <>
          <div className={styles.paginationHeader}>
            <span className={styles.paginationInfo}>
              {collection.length} juegos · página {page} de {totalPages}
            </span>
          </div>
          <div className={styles.gameGrid}>
            {slice.map((game, i) => (
              <GameCard
                key={game.id}
                game={game}
                index={i}
                logPlayHref={
                  canCreate
                    ? `/bg-watch/${bggUsername}/partidas/nueva?juego=${game.id}&volver=${encodeURIComponent(
                        `/bg-watch/${bggUsername}/coleccion`,
                      )}`
                    : null
                }
              />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={handlePage} />
        </>
      )}
    </div>
  );
}
