import styles from "../BgWatchProfile.module.css";

// Win rate global del usuario. `wins`/`rated` vienen de la agregación COMPLETA
// del servidor (GET /resumen), no del page-sample de la lista. `rated` = plays
// con el dueño identificado (las únicas medibles); si es 0 no hay nada que
// mostrar → "—".
export default function WinRateWidget({ wins, rated }) {
  const pct = rated > 0 ? Math.round((wins / rated) * 100) : null;

  return (
    <div className={styles.sideWidget}>
      <div className={styles.sideWidgetLabel}>◆ Win rate</div>
      {pct === null ? (
        <div className={styles.winRateEmpty}>—</div>
      ) : (
        <>
          <div className={styles.winRateRow}>
            <span className={styles.winRateValue}>{pct}%</span>
            <span className={styles.winRateMeta}>
              en {rated} {rated === 1 ? "partida medida" : "partidas medidas"}
            </span>
          </div>
          <div className={styles.winRateBar}>
            <div
              className={styles.winRateBarFill}
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}
