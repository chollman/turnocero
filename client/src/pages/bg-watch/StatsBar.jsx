import styles from "./BgWatchProfile.module.css";

function formatDate(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.split("-");
  return new Date(year, month - 1, day).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function StatsBar({ collection, playsMeta }) {
  const totalPartidas = playsMeta?.total ?? null;
  const juegosUnicos = collection?.length ?? null;

  // Prefer the server-aggregated top game (from the actual plays log) when
  // available. Falls back to the collection's `numPlays` field for profiles
  // that haven't been synced into BggPlay yet — that path can miss games
  // played but not owned.
  let topGame = playsMeta?.topGame ?? null;
  if (!topGame && collection && collection.length > 0) {
    topGame = collection.reduce(
      (best, g) => ((g.numPlays || 0) > (best?.numPlays || 0) ? g : best),
      null,
    );
    if (!topGame || (topGame.numPlays || 0) === 0) topGame = null;
  }

  const ultimaPartida = playsMeta?.lastDate || null;

  return (
    <div className={styles.statsBar}>
      <div className={styles.statCard}>
        <span className={styles.statLabel}>Partidas</span>
        <span className={styles.statValue}>
          {totalPartidas !== null ? totalPartidas : "—"}
        </span>
      </div>
      <div className={styles.statCard}>
        <span className={styles.statLabel}>Juegos únicos</span>
        <span className={styles.statValue}>
          {juegosUnicos !== null ? juegosUnicos : "—"}
        </span>
      </div>
      <div className={styles.statCard}>
        <span className={styles.statLabel}>Más jugado</span>
        <span className={styles.statValueSm} title={topGame?.name || ""}>
          {topGame ? topGame.name : "—"}
        </span>
        {topGame && (
          <span className={styles.statHint}>{topGame.numPlays}× partidas</span>
        )}
      </div>
      <div className={styles.statCard}>
        <span className={styles.statLabel}>Última partida</span>
        <span className={styles.statValueSm}>
          {ultimaPartida ? formatDate(ultimaPartida) : "—"}
        </span>
      </div>
    </div>
  );
}
