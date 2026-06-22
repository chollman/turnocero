import { useTranslation } from "react-i18next";
import UserRef from "../../../components/shared/UserRef";
import styles from "../TorneoDetail.module.css";

export default function LeagueStandings({ standings, participants }) {
  const { t } = useTranslation("torneos");
  if (!standings || standings.length === 0) {
    return <p className={styles.emptyMsg}>{t("league.emptyStandings")}</p>;
  }

  // Build user lookup so we can render names from the participants array (populated).
  const userById = new Map();
  for (const p of participants) {
    userById.set(String(p._id || p), p);
  }

  return (
    <div className={styles.standingsWrap}>
      <table className={styles.standingsTable}>
        <thead>
          <tr>
            <th className={styles.colPos}>#</th>
            <th>{t("league.player")}</th>
            <th className={styles.colNum}>{t("league.colPlayed")}</th>
            <th className={styles.colNum}>{t("league.colWon")}</th>
            <th className={styles.colNum}>{t("league.colDrawn")}</th>
            <th className={styles.colNum}>{t("league.colLost")}</th>
            <th className={styles.colNum}>{t("league.colPts")}</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, idx) => {
            const user = userById.get(String(row.user));
            return (
              <tr key={row.user} className={idx === 0 ? styles.rowLeader : ""}>
                <td className={styles.colPos}>{idx + 1}</td>
                <td>
                  <UserRef user={user || { _id: row.user }} />
                </td>
                <td className={styles.colNum}>{row.played}</td>
                <td className={styles.colNum}>{row.won}</td>
                <td className={styles.colNum}>{row.drawn}</td>
                <td className={styles.colNum}>{row.lost}</td>
                <td className={`${styles.colNum} ${styles.colPts}`}>
                  {row.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
