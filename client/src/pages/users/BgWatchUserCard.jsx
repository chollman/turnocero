import Meeple from "../../components/shared/Meeple";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBgWatchQuickStatsQuery } from "../../queries/bgWatch";
import { getLocale } from "../../utils/locale";
import styles from "./BgWatchUserCard.module.css";

function formatDate(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.split("-");
  return new Date(year, month - 1, day).toLocaleDateString(getLocale(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const DieIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="8" cy="16" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="16" cy="16" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

const ArrowIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

export default function BgWatchUserCard({ bggUsername }) {
  const { t } = useTranslation();
  const { data, isPending: loading } = useBgWatchQuickStatsQuery(bggUsername, {
    includeExtra: true,
  });
  const stats = data || {
    partidas: null,
    juegos: null,
    lastDate: null,
    topGame: null,
  };
  const error = !loading && data?.ok === false;

  const initial = bggUsername?.charAt(0)?.toUpperCase() || "?";
  const partidasDisplay = loading ? "…" : (stats.partidas ?? "—");
  const juegosDisplay = loading ? "…" : (stats.juegos ?? "—");
  const lastDateDisplay = loading ? "…" : (formatDate(stats.lastDate) ?? "—");
  const topGame = stats.topGame;

  return (
    <Link
      to={`/bg-watch/${encodeURIComponent(bggUsername)}`}
      className={styles.card}
    >
      <div className={styles.header}>
        <div className={styles.avatar} aria-hidden="true">
          <span className={styles.avatarLetter}>{initial}</span>
          <span className={styles.avatarBadge}>
            <DieIcon />
          </span>
        </div>
        <div className={styles.identity}>
          <span className={styles.eyebrow}><Meeple />{t("usuarios:bggCard.eyebrow")}</span>
          <span className={styles.username}>@{bggUsername}</span>
          <span className={styles.connectedTag}>
            <span className={styles.connectedDot} aria-hidden="true" />
            {t("usuarios:bggCard.connected")}
          </span>
        </div>
        <span className={styles.ctaInline}>
          {t("usuarios:bggCard.ctaInline")}
          <ArrowIcon />
        </span>
      </div>

      {(loading || topGame) && (
        <div className={styles.topGame}>
          {loading ? (
            <>
              <div
                className={`${styles.thumb} ${styles.thumbSkeleton}`}
                aria-hidden="true"
              />
              <div className={styles.topGameInfo}>
                <span className={styles.topGameLabel}>{t("usuarios:bggCard.topGameLabel")}</span>
                <span
                  className={`${styles.topGameName} ${styles.skeletonLine}`}
                  aria-hidden="true"
                />
                <span
                  className={`${styles.topGamePlays} ${styles.skeletonLineSm}`}
                  aria-hidden="true"
                />
              </div>
            </>
          ) : (
            <>
              {topGame.thumbnail ? (
                <img
                  src={topGame.thumbnail}
                  alt=""
                  className={styles.thumb}
                  loading="lazy"
                />
              ) : (
                <div
                  className={`${styles.thumb} ${styles.thumbFallback}`}
                  aria-hidden="true"
                >
                  <DieIcon />
                </div>
              )}
              <div className={styles.topGameInfo}>
                <span className={styles.topGameLabel}>{t("usuarios:bggCard.topGameLabel")}</span>
                <span className={styles.topGameName}>{topGame.name}</span>
                <span className={styles.topGamePlays}>
                  {t("usuarios:bggCard.plays", { count: topGame.numPlays })}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>{t("usuarios:bggCard.statPlays")}</span>
          <span className={styles.statValue}>{partidasDisplay}</span>
        </div>
        <div className={styles.statDivider} aria-hidden="true" />
        <div className={styles.statItem}>
          <span className={styles.statLabel}>{t("usuarios:bggCard.statCollection")}</span>
          <span className={styles.statValue}>{juegosDisplay}</span>
        </div>
        <div className={styles.statDivider} aria-hidden="true" />
        <div className={styles.statItem}>
          <span className={styles.statLabel}>{t("usuarios:bggCard.statLastPlay")}</span>
          <span className={styles.statValueSm}>{lastDateDisplay}</span>
        </div>
      </div>

      {error && !loading && (
        <p className={styles.errorNote}>{t("usuarios:bggCard.errorNote")}</p>
      )}
    </Link>
  );
}
