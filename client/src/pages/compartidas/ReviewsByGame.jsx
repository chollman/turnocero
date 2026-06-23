import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation, Trans } from "react-i18next";
import axios from "axios";
import { useBrandName } from "../../hooks/useBrandName";
import { API } from "../../api/endpoints";
import ResenaCard from "./ResenaCard";
import CompartidasSidebar from "./CompartidasSidebar";
import CompartidaSkeleton from "./CompartidaSkeleton";
import EmptyState from "../../components/shared/EmptyState";
import { ArtCompartida } from "../../components/shared/EmptyArt";
import BackButton from "../../components/shared/BackButton";
import pageStyles from "./CompartidaPost.module.css";
import styles from "./ReviewsByGame.module.css";

// Página pública de reseñas por juego (descubrimiento + SEO): encabezado del
// juego con el promedio de la comunidad + la lista de reseñas. Indexable, así
// que apunta a búsquedas long-tail ("reseña <juego>").
export default function ReviewsByGame() {
  const { t } = useTranslation("compartidas");
  const { bggId } = useParams();
  const brandName = useBrandName();

  const [game, setGame] = useState(null);
  const [avgRating, setAvgRating] = useState(null);
  const [total, setTotal] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const loadPage = useCallback(
    async (pageNum, replace, signal) => {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const { data } = await axios.get(API.compartidas.BY_GAME(bggId), {
          params: { page: pageNum, limit: 10 },
          signal,
        });
        setGame(data.game);
        setAvgRating(data.avgRating);
        setTotal(data.total);
        setPages(data.pages);
        setPage(pageNum);
        setReviews((prev) =>
          replace ? data.reviews : [...prev, ...data.reviews],
        );
      } catch (err) {
        if (axios.isCancel(err)) return;
        if (err.response?.status === 404)
          setError(t("reviewsByGame.errorNotFound"));
        else setError(t("reviewsByGame.errorLoad"));
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [bggId, t],
  );

  useEffect(() => {
    const ac = new AbortController();
    setError("");
    setReviews([]);
    loadPage(1, true, ac.signal);
    return () => ac.abort();
  }, [loadPage]);

  const handleDeleted = (id) => {
    setReviews((prev) => prev.filter((r) => r._id !== id));
    setTotal((t) => Math.max(0, t - 1));
  };
  const handleUpdated = (updated) =>
    setReviews((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));

  const gameName = game?.name || t("reviewsByGame.gameFallback");
  const metaTitle = t("reviewsByGame.metaTitle", {
    game: gameName,
    brand: brandName,
  });
  const metaDesc =
    total > 0
      ? t("reviewsByGame.metaDescWithCount", {
          count: total,
          game: gameName,
          avg:
            avgRating != null
              ? t("reviewsByGame.metaDescAvg", { avg: avgRating })
              : "",
        })
      : t("reviewsByGame.metaDescEmpty", { game: gameName });
  const cover = game?.image || game?.thumbnail || "";

  return (
    <div className={pageStyles.page}>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:type" content="website" />
        {cover && <meta property="og:image" content={cover} />}
      </Helmet>

      <div className={pageStyles.layout}>
        <div className={pageStyles.feedCol}>
          <BackButton to="/compartidas" flush>
            {t("reviewsByGame.back")}
          </BackButton>

          {loading ? (
            <CompartidaSkeleton />
          ) : error ? (
            <div className={pageStyles.errorBox}>
              <p>{error}</p>
            </div>
          ) : (
            <>
              <header
                className={styles.gameHead}
                style={cover ? { backgroundImage: `url(${cover})` } : undefined}
              >
                <div className={styles.gameHeadOverlay} />
                <div className={styles.gameHeadInner}>
                  {cover ? (
                    <img
                      src={game.thumbnail || game.image}
                      alt={gameName}
                      className={styles.cover}
                      loading="lazy"
                    />
                  ) : (
                    <span className={styles.cover} aria-hidden="true">
                      🎲
                    </span>
                  )}
                  <div className={styles.gameHeadInfo}>
                    <span className={styles.eyebrow}>{t("reviewsByGame.eyebrow")}</span>
                    <h1 className={styles.gameName}>
                      {gameName}
                      {game?.year ? (
                        <span className={styles.gameYear}> ({game.year})</span>
                      ) : null}
                    </h1>
                    <span className={styles.count}>
                      {t("reviewsByGame.resena", { count: total })}
                    </span>
                  </div>
                  {avgRating != null && (
                    <div
                      className={styles.avgBadge}
                      aria-label={t("reviewsByGame.avgAria", { avg: avgRating })}
                    >
                      <span className={styles.avgNum}>{avgRating}</span>
                      <span className={styles.avgMax}>/10</span>
                      <span className={styles.avgLabel}>{t("reviewsByGame.avgLabel")}</span>
                    </div>
                  )}
                </div>
              </header>

              {reviews.length === 0 ? (
                <EmptyState
                  compact
                  art={<ArtCompartida />}
                  eyebrow={t("reviewsByGame.emptyEyebrow")}
                  title={
                    <Trans
                      i18nKey="compartidas:reviewsByGame.emptyTitle"
                      values={{ game: gameName }}
                      components={{ em: <em /> }}
                    />
                  }
                  text={t("reviewsByGame.emptyText")}
                  primary={{
                    label: t("reviewsByGame.emptyPrimary"),
                    to: "/compartidas",
                  }}
                />
              ) : (
                <>
                  {reviews.map((post) => (
                    <ResenaCard
                      key={post._id}
                      post={post}
                      onDeleted={handleDeleted}
                      onUpdated={handleUpdated}
                    />
                  ))}
                  {page < pages && (
                    <button
                      className={styles.loadMoreBtn}
                      onClick={() => loadPage(page + 1, false)}
                      disabled={loadingMore}
                    >
                      {loadingMore
                        ? t("reviewsByGame.loadingMore")
                        : t("reviewsByGame.loadMore")}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
        <CompartidasSidebar />
      </div>
    </div>
  );
}
