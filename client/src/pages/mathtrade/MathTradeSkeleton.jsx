import styles from "./MathTradeSkeleton.module.css";

// Placeholder shimmer para las cards de la lista mientras carga.
export default function MathTradeSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={styles.top}>
        <span className={styles.lineTitle} />
        <span className={styles.chip} />
      </div>
      <span className={styles.line} />
      <span className={styles.lineShort} />
      <div className={styles.meta}>
        <span className={styles.pill} />
        <span className={styles.pill} />
      </div>
    </div>
  );
}
