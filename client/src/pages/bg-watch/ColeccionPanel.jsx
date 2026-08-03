import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useBggCollectionQuery,
  useBggCollectionCooldownQuery,
  refreshBggCollection,
  bggKeys,
} from "../../queries/bgg";
import Pagination from "./Pagination";
import GameCardSkeleton from "./GameCardSkeleton";
import styles from "./BgWatchProfile.module.css";

const COLLECTION_PAGE_SIZE = 24;

function StarRating({ value }) {
  if (!value) return <span className={styles.ratingNull}>—</span>;
  return <span className={styles.rating}>{Number(value).toFixed(1)}</span>;
}

function GameCard({ game, index = 0, logPlayHref = null }) {
  const { t } = useTranslation("bgwatch");
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
          {(game.numPlays || 0) === 0
            ? t("coleccion.unplayed")
            : t("coleccion.playsTimes", { n: game.numPlays })}
        </span>
      </div>
      <div className={styles.gameInfo}>
        <div className={styles.gameName}>{game.name}</div>
        {game.yearPublished && (
          <div className={styles.gameYear}>{game.yearPublished}</div>
        )}
        <div className={styles.gameRatings}>
          <span className={styles.ratingBlock}>
            <span className={styles.ratingLabel}>
              {t("coleccion.yourRating")}
            </span>
            <StarRating value={game.userRating} />
          </span>
          <span className={styles.ratingBlock}>
            <span className={styles.ratingLabel}>{t("coleccion.bggRating")}</span>
            <StarRating value={game.bggRating} />
          </span>
          {game.numPlays > 0 && (
            <span className={styles.ratingBlock}>
              <span className={styles.ratingLabel}>
                {t("coleccion.partidas")}
              </span>
              <span className={styles.rating}>
                {t("coleccion.playsTimes", { n: game.numPlays })}
              </span>
            </span>
          )}
        </div>
        {logPlayHref && (
          <Link to={logPlayHref} className={styles.gamePlayBtn}>
            {t("coleccion.logPlay")}
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
  const { t } = useTranslation("bgwatch");
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [refreshError, setRefreshError] = useState(null);

  const {
    data: collection,
    isPending: loading,
    error: queryError,
  } = useBggCollectionQuery(bggUsername);
  const error = refreshError
    ? refreshError
    : queryError
      ? queryError.response?.data?.message || t("coleccion.loadError")
      : null;

  useEffect(() => {
    if (collection) onLoaded?.(collection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection]);

  // Server-driven cooldown: cada GET (no solo el refresh manual) devuelve el
  // header — sincronizado por useBggCollectionQuery a un cache-entry propio.
  const { data: cooldownUntilFromServer } = useBggCollectionCooldownQuery(bggUsername);
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

  const handleRefresh = async () => {
    if (loading || refreshBusy || inCooldown) return;
    setRefreshBusy(true);
    setRefreshError(null);
    try {
      const { data, cooldownMs } = await refreshBggCollection(bggUsername);
      queryClient.setQueryData(bggKeys.coleccion(bggUsername), data);
      const until = cooldownMs > 0 ? Date.now() + cooldownMs : 0;
      queryClient.setQueryData(bggKeys.coleccionCooldown(bggUsername), until);
      if (cooldownMs > 0) {
        setCooldownUntil(until);
        setNow(Date.now());
      }
    } catch (err) {
      const cooldownMs = err.cooldownMs || 0;
      if (cooldownMs > 0) {
        setCooldownUntil(Date.now() + cooldownMs);
        setNow(Date.now());
      }
      setRefreshError(err.response?.data?.message || t("coleccion.loadError"));
    } finally {
      setRefreshBusy(false);
    }
  };

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
            onClick={handleRefresh}
            disabled={loading || refreshBusy || inCooldown}
            aria-label={t("coleccion.refreshLabel")}
            style={{ marginLeft: "auto" }}
          >
            {inCooldown
              ? t("coleccion.refreshWait", { n: cooldownRemaining })
              : t("coleccion.refresh")}
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
          <p>{t("coleccion.empty")}</p>
        </div>
      )}

      {!loading && collection && collection.length > 0 && (
        <>
          <div className={styles.paginationHeader}>
            <span className={styles.paginationInfo}>
              {t("coleccion.header", {
                n: collection.length,
                page,
                total: totalPages,
              })}
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
