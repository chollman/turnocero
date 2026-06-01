import styles from "./Auth.module.css";
import { getLocationDisplay } from "../../utils/location";

function formatShowcaseDate(dateStr) {
  const d = new Date(dateStr);
  const weekday = d.toLocaleDateString("es-AR", { weekday: "short" });
  const day = d.getDate();
  const month = d.toLocaleDateString("es-AR", { month: "short" });
  const time = d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${weekday} ${day} ${month} · ${time}`.replace(/\./g, "");
}

// Carta de mesa del showcase legacy (panel derecho de VerifyEmail /
// ForgotPassword / ResetPassword, que conservan el layout anterior con
// GameTile). El nuevo Auth (login/register) usa su propia PreviewCard.
export default function ShowcaseCard({ table }) {
  const filled = table.players.length + 1;
  const total = table.maxPlayers + 1;
  const available = total - filled;
  const pct = Math.min(100, (filled / total) * 100);
  const loc = getLocationDisplay(table.location, "city");
  return (
    <div className={styles.showcaseCard}>
      <div className={styles.showcaseCardGame}>{table.boardGame}</div>
      <div className={styles.showcaseCardMeta}>
        {table.host.username}
        {loc ? ` · ${loc}` : ""}
      </div>
      <div className={styles.showcaseCardBar}>
        <div className={styles.showcaseCardFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.showcaseCardFooter}>
        <span className={styles.showcaseCardSeats}>
          ● {available} lugar{available !== 1 ? "es" : ""}
        </span>
        <span className={styles.showcaseCardDate}>
          {formatShowcaseDate(table.date)}
        </span>
      </div>
    </div>
  );
}
