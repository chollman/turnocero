import { useTranslation } from "react-i18next";
import styles from "./Auth.module.css";
import { getLocationDisplay } from "../../utils/location";
import { getLocale } from "../../utils/locale";

function formatShowcaseDate(dateStr) {
  const d = new Date(dateStr);
  const locale = getLocale();
  const weekday = d.toLocaleDateString(locale, { weekday: "short" });
  const day = d.getDate();
  const month = d.toLocaleDateString(locale, { month: "short" });
  const time = d.toLocaleTimeString(locale, {
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
  const { t } = useTranslation();
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
          ● {t("auth:showcaseHome.seats", { count: available })}
        </span>
        <span className={styles.showcaseCardDate}>
          {formatShowcaseDate(table.date)}
        </span>
      </div>
    </div>
  );
}
