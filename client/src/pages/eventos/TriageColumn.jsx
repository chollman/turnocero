import InscItem from "./InscItem";
import styles from "./TriageColumn.module.css";

const TONE_CLASS = {
  pending: styles.pending,
  confirmed: styles.confirmed,
  rejected: styles.rejected,
};

// `now` viene siempre del caller (EventoInscripciones) para no romper la regla
// react-hooks/purity con un default impuro (`Date.now()`). Tests deben pasarlo.
export default function TriageColumn({
  title,
  status,
  items,
  emptyText,
  onAccept,
  onReject,
  onUndo,
  now,
}) {
  const toneClass = TONE_CLASS[status] || "";
  const labelClass =
    status === "pending"
      ? styles.labelOrange
      : status === "confirmed"
        ? styles.labelGreen
        : "";

  return (
    <section className={`${styles.col} ${toneClass}`}>
      <div className={styles.head}>
        <span className={`${styles.label} ${labelClass}`}>◆ {title}</span>
        <span className={styles.count}>{items.length}</span>
      </div>
      <div className={styles.body}>
        {items.length === 0 ? (
          <div className={styles.empty}>{emptyText}</div>
        ) : (
          items.map((reg) => (
            <InscItem
              key={reg._id || (reg.user?._id ?? reg.user)}
              reg={reg}
              onAccept={onAccept}
              onReject={onReject}
              onUndo={onUndo}
              now={now}
            />
          ))
        )}
      </div>
    </section>
  );
}
