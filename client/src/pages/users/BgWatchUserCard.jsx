import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API } from "../../api/endpoints";
import styles from "./BgWatchUserCard.module.css";

function formatDate(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.split("-");
  return new Date(year, month - 1, day).toLocaleDateString("es-AR", {
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
  const [stats, setStats] = useState({
    partidas: null,
    juegos: null,
    lastDate: null,
    topGame: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!bggUsername) return;
    let cancelled = false;
    setLoading(true);
    setError(false);

    const partidasReq = axios
      .get(API.bgg.PARTIDAS(bggUsername), { params: { page: 1 } })
      .then((r) => r.data)
      .catch(() => null);

    const coleccionReq = axios
      .get(API.bgg.COLECCION(bggUsername))
      .then((r) => r.data)
      .catch(() => null);

    Promise.all([partidasReq, coleccionReq]).then(([partidas, coleccion]) => {
      if (cancelled) return;
      const ok = partidas !== null || coleccion !== null;

      // Prefer the server-aggregated top game (computed from BggPlay log)
      // when present. Falls back to collection's numPlays only for profiles
      // that haven't been synced yet — that path misses unowned games and
      // doesn't work for users with private collections (e.g. H3rmit87).
      let topGame = partidas?.topGame ?? null;
      if (!topGame && Array.isArray(coleccion) && coleccion.length > 0) {
        const sorted = [...coleccion]
          .filter((g) => g.numPlays > 0)
          .sort((a, b) => b.numPlays - a.numPlays);
        topGame = sorted[0] || null;
      }

      setStats({
        partidas: partidas?.total ?? null,
        juegos: Array.isArray(coleccion) ? coleccion.length : null,
        lastDate: partidas?.plays?.[0]?.date ?? null,
        topGame,
      });
      setError(!ok);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [bggUsername]);

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
          <span className={styles.eyebrow}>◆ BG WATCH</span>
          <span className={styles.username}>@{bggUsername}</span>
          <span className={styles.connectedTag}>
            <span className={styles.connectedDot} aria-hidden="true" />
            Conectado a BoardGameGeek
          </span>
        </div>
        <span className={styles.ctaInline}>
          Ver BG Watch
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
                <span className={styles.topGameLabel}>JUEGO MÁS JUGADO</span>
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
                <span className={styles.topGameLabel}>JUEGO MÁS JUGADO</span>
                <span className={styles.topGameName}>{topGame.name}</span>
                <span className={styles.topGamePlays}>
                  {topGame.numPlays}{" "}
                  {topGame.numPlays === 1 ? "partida" : "partidas"}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Partidas</span>
          <span className={styles.statValue}>{partidasDisplay}</span>
        </div>
        <div className={styles.statDivider} aria-hidden="true" />
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Juegos en colección</span>
          <span className={styles.statValue}>{juegosDisplay}</span>
        </div>
        <div className={styles.statDivider} aria-hidden="true" />
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Última partida</span>
          <span className={styles.statValueSm}>{lastDateDisplay}</span>
        </div>
      </div>

      {error && !loading && (
        <p className={styles.errorNote}>
          No se pudieron cargar las estadísticas ahora. Igual podés entrar al BG
          Watch.
        </p>
      )}
    </Link>
  );
}
