import NotifIcon from "./NotifIcons";
import styles from "./NotifRow.module.css";

// Reemplazo transitorio (~1.8s) que confirma una acción inline antes de que la
// fila se marque resuelta / se descarte. `action` es 'accept' | 'reject'.
function resolvedTitle(notif, action) {
  if (action === "reject") return "Listo, lo descartamos";
  const name =
    notif.actors?.[0]?.username ||
    notif.fromUsername ||
    notif.lastRequesterUsername ||
    "el usuario";
  if (notif.type === "friend_request") return `Ahora sos amigo de ${name}`;
  if (notif.type === "join_request") {
    return notif.tableName
      ? `Aceptaste a ${name} en ${notif.tableName}`
      : `Aceptaste a ${name}`;
  }
  return "¡Hecho!";
}

export default function ResolvedRow({ notif, action }) {
  const accepted = action === "accept";
  return (
    <li
      className={`${styles.row} ${styles.resolved}`}
      role="status"
      aria-live="polite"
    >
      <span
        className={`${styles.resolvedIcon} ${accepted ? styles.resolvedOk : styles.resolvedNo}`}
      >
        <NotifIcon name={accepted ? "Check" : "X"} size={18} />
      </span>
      <div className={styles.body}>
        <span className={styles.title}>{resolvedTitle(notif, action)}</span>
      </div>
    </li>
  );
}
