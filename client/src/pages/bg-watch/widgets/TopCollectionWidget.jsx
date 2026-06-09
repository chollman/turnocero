import { Link } from "react-router-dom";
import styles from "../BgWatchProfile.module.css";

// Top 5 juegos más jugados (mini-ranking con barra proporcional). `games` ya
// viene ordenado desc por numPlays desde PartidasPanel (lista server-agregada o
// derivada de la colección). #1 va en gold; el resto en púrpura. Cada fila
// linkea a la vista por-juego.
export default function TopCollectionWidget({ games, bggUsername }) {
  const top = (games || []).slice(0, 5);
  if (top.length === 0) return null;
  const max = top[0]?.numPlays || 1;

  return (
    <div className={styles.sideWidget}>
      <div className={styles.sideWidgetLabel}>◆ Top de la colección</div>
      <div className={styles.miniRankList}>
        {top.map((g, i) => (
          <Link
            key={g.id}
            to={`/bg-watch/${encodeURIComponent(bggUsername)}/juego/${g.id}`}
            className={styles.miniRank}
            title={g.name}
          >
            <span
              className={`${styles.miniRankNum} ${i === 0 ? styles.miniRankNumTop : ""}`}
            >
              {i + 1}
            </span>
            <div className={styles.miniRankInfo}>
              <div className={styles.miniRankName}>{g.name}</div>
              <div className={styles.miniRankBar}>
                <div
                  className={`${styles.miniRankBarFill} ${i === 0 ? styles.miniRankBarFillGold : ""}`}
                  style={{ width: `${Math.max(6, (g.numPlays / max) * 100)}%` }}
                />
              </div>
            </div>
            <span className={styles.miniRankCount}>{g.numPlays}×</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
