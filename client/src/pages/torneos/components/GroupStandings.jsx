import { useTranslation } from "react-i18next";
import UserRef from "../../../components/shared/UserRef";
import { getUserDisplay } from "../../../utils/userDisplay";
import styles from "../TorneoDetail.module.css";

export default function GroupStandings({
  standings,
  players,
  gamesPerGroup,
  qualifiersPerGroup,
}) {
  const { t } = useTranslation("torneos");
  if (!standings || standings.length === 0) {
    return <p className={styles.emptyMsg}>{t("groupStandings.empty")}</p>;
  }

  const byId = new Map((players || []).map((p) => [String(p._id || p), p]));

  return (
    <div className={styles.standingsWrap}>
      <table className={styles.standingsTable}>
        <thead>
          <tr>
            <th className={styles.colPos}>#</th>
            <th>{t("groupStandings.player")}</th>
            <th className={styles.colNum}>{t("groupStandings.colPlayed")}</th>
            {Array.from({ length: gamesPerGroup }).map((_, i) => (
              <th key={i} className={styles.colNum}>
                {t("groupStandings.colGame", { number: i + 1 })}
              </th>
            ))}
            <th className={`${styles.colNum} ${styles.colPts}`}>
              {t("groupStandings.colTotalPV")}
            </th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, idx) => {
            const user = byId.get(String(row.user));
            const info = getUserDisplay(user || { _id: row.user });
            const isQualifying = idx < (qualifiersPerGroup ?? 0);
            return (
              <tr
                key={row.user}
                className={isQualifying ? styles.rowLeader : ""}
              >
                <td className={styles.colPos}>{idx + 1}</td>
                <td>
                  {info.isDeleted ? (
                    <span className={styles.deletedTxt}>
                      {t("groupStandings.deletedUser")}
                    </span>
                  ) : (
                    <UserRef user={user || { _id: row.user }} />
                  )}
                </td>
                <td className={styles.colNum}>{row.played}</td>
                {Array.from({ length: gamesPerGroup }).map((_, i) => (
                  <td key={i} className={styles.colNum}>
                    {row.byGame?.[i] != null ? row.byGame[i] : "—"}
                  </td>
                ))}
                <td className={`${styles.colNum} ${styles.colPts}`}>
                  {row.totalPV}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
