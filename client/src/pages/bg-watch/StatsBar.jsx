import { useTranslation } from "react-i18next";
import { getLocale } from "../../utils/locale";
import styles from "./BgWatchProfile.module.css";

function formatDate(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.split("-");
  return new Date(year, month - 1, day).toLocaleDateString(getLocale(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function StatsBar({ collection, playsMeta }) {
  const { t } = useTranslation("bgwatch");

  // Each source resolves independently (plays log vs. collection), so each card
  // tracks its own loading state — a `null` prop means the backend hasn't
  // answered yet, and we show a shimmer skeleton instead of an em-dash.
  const playsLoading = playsMeta == null;
  const collectionLoading = collection == null;

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
  // The top game isn't known until we either find one or both sources settle
  // (the collection is the fallback when the plays log has no winner).
  const topGameLoading = !topGame && (playsLoading || collectionLoading);

  const ultimaPartida = playsMeta?.lastDate || null;

  return (
    <div className={styles.statsBar}>
      <div className={`${styles.statCard} ${styles.statAccent}`}>
        <span className={styles.statLabel}>{t("stats.partidas")}</span>
        {playsLoading ? (
          <span aria-hidden="true" className={`${styles.bone} ${styles.boneValue}`} />
        ) : (
          <span className={styles.statValue}>{totalPartidas ?? "—"}</span>
        )}
      </div>
      <div className={styles.statCard}>
        <span className={styles.statLabel}>{t("stats.uniqueGames")}</span>
        {collectionLoading ? (
          <span aria-hidden="true" className={`${styles.bone} ${styles.boneValue}`} />
        ) : (
          <span className={styles.statValue}>{juegosUnicos ?? "—"}</span>
        )}
      </div>
      <div className={`${styles.statCard} ${styles.statPurple}`}>
        <span className={styles.statLabel}>{t("stats.topGame")}</span>
        {topGameLoading ? (
          <span aria-hidden="true" className={`${styles.bone} ${styles.boneText}`} />
        ) : (
          <span className={styles.statValueSm} title={topGame?.name || ""}>
            {topGame ? topGame.name : "—"}
          </span>
        )}
        {topGame && (
          <span className={styles.statHint}>
            {t("stats.topGamePlays", { n: topGame.numPlays })}
          </span>
        )}
      </div>
      <div className={`${styles.statCard} ${styles.statGold}`}>
        <span className={styles.statLabel}>{t("stats.lastPlay")}</span>
        {playsLoading ? (
          <span aria-hidden="true" className={`${styles.bone} ${styles.boneText}`} />
        ) : (
          <span className={styles.statValueSm}>
            {ultimaPartida ? formatDate(ultimaPartida) : "—"}
          </span>
        )}
      </div>
    </div>
  );
}
