import Meeple from "../../components/shared/Meeple";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBgWatchQuickStatsQuery } from "../../queries/bgWatch";
import styles from "./MiBgWatchCard.module.css";

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

/**
 * Banda BG Watch ("Mi BG Watch") arriba de /perfil para usuarios con la
 * conexión activa. Stats livianas + CTA al perfil BG Watch propio.
 * Diseño: card púrpura (handoff "Mi Perfil Reimagined" → .bgwBand).
 */
export default function MiBgWatchCard({ bggUsername, avatarUrl }) {
  const { t } = useTranslation();
  const { data, isPending: loading } = useBgWatchQuickStatsQuery(bggUsername);
  const stats = data || { partidas: null, juegos: null };

  const initial = bggUsername?.charAt(0)?.toUpperCase() || "?";
  const partidasDisplay = loading ? "…" : (stats.partidas ?? "—");
  const juegosDisplay = loading ? "…" : (stats.juegos ?? "—");

  return (
    <Link
      to={`/bg-watch/${encodeURIComponent(bggUsername)}`}
      className={styles.band}
    >
      <div className={styles.avatar} aria-hidden="true">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className={styles.avatarImg} />
        ) : (
          <span className={styles.avatarLetter}>{initial}</span>
        )}
        <span className={styles.die}>
          <DieIcon />
        </span>
      </div>

      <div className={styles.info}>
        <span className={styles.kicker}>
          <Meeple />
          {t("usuarios:miBgWatch.kicker")}
        </span>
        <span className={styles.username}>@{bggUsername}</span>
        <span className={styles.connectedTag}>
          <span className={styles.connectedDot} aria-hidden="true" />
          {t("usuarios:miBgWatch.connected")}
        </span>
      </div>

      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{partidasDisplay}</span>
          <span className={styles.statLabel}>{t("usuarios:miBgWatch.statPlays")}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{juegosDisplay}</span>
          <span className={styles.statLabel}>{t("usuarios:miBgWatch.statCollection")}</span>
        </div>
        <span className={styles.go}>
          {t("usuarios:miBgWatch.go")}
          <ArrowIcon />
        </span>
      </div>
    </Link>
  );
}
