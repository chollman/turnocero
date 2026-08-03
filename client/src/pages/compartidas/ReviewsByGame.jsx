import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { useTranslation, Trans } from "react-i18next";
import { useBrandName } from "../../hooks/useBrandName";
import { useReviewsByGameQuery, compartidaKeys } from "../../queries/compartidas";
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
  const queryClient = useQueryClient();
  const listKey = compartidaKeys.byGame(bggId);
  const {
    data,
    isPending: loading,
    isFetchingNextPage: loadingMore,
    error: queryError,
    hasNextPage,
    fetchNextPage,
  } = useReviewsByGameQuery(bggId);
  const game = data?.pages[0]?.game || null;
  const avgRating = data?.pages[0]?.avgRating ?? null;
  const total = data?.pages[0]?.total ?? 0;
  const reviews = useMemo(
    () => data?.pages.flatMap((p) => p.reviews) ?? [],
    [data],
  );
  const error = queryError
    ? queryError.response?.status === 404
      ? t("reviewsByGame.errorNotFound")
      : t("reviewsByGame.errorLoad")
    : "";

  const handleDeleted = (id) => {
    queryClient.setQueryData(listKey, (old) => {
      if (!old) return old;
      const pages = old.pages.map((p) => ({
        ...p,
        reviews: p.reviews.filter((r) => r._id !== id),
        total: Math.max(0, p.total - 1),
      }));
      return { ...old, pages };
    });
  };
  const handleUpdated = (updated) => {
    queryClient.setQueryData(listKey, (old) => {
      if (!old) return old;
      const pages = old.pages.map((p) => ({
        ...p,
        reviews: p.reviews.map((r) => (r._id === updated._id ? updated : r)),
      }));
      return { ...old, pages };
    });
  };

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
                  {hasNextPage && (
                    <button
                      className={styles.loadMoreBtn}
                      onClick={() => fetchNextPage()}
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
