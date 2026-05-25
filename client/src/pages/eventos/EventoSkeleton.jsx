import styles from "./EventoSkeleton.module.css";

export default function EventoSkeleton({ variant = "timeline" }) {
  if (variant === "poster") {
    return (
      <div className={styles.poster}>
        <div className={styles.posterImg} />
        <div className={styles.posterBody}>
          <div className={`${styles.line} ${styles.posterTitle}`} />
          <div className={`${styles.line} ${styles.posterMeta}`} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.row}>
      <div className={styles.date}>
        <div className={`${styles.line} ${styles.dateWeekday}`} />
        <div className={`${styles.line} ${styles.dateDay}`} />
        <div className={`${styles.line} ${styles.dateTime}`} />
      </div>
      <div className={styles.content}>
        <div className={styles.badges}>
          <div className={`${styles.line} ${styles.badge}`} />
          <div className={`${styles.line} ${styles.badge}`} />
        </div>
        <div className={`${styles.line} ${styles.title}`} />
        <div className={`${styles.line} ${styles.meta}`} />
        <div className={`${styles.line} ${styles.desc}`} />
      </div>
      <div className={styles.right}>
        <div className={`${styles.line} ${styles.fee}`} />
        <div className={`${styles.line} ${styles.cta}`} />
      </div>
    </div>
  );
}
