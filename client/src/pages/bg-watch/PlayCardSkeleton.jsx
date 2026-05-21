import styles from "./PlayCardSkeleton.module.css";

export default function PlayCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={`${styles.bone} ${styles.thumb}`} />
      <div className={styles.body}>
        <div className={styles.topRow}>
          <div className={`${styles.bone} ${styles.gameName}`} />
          <div className={`${styles.bone} ${styles.dateBlock}`} />
        </div>
        <div className={styles.players}>
          <div className={`${styles.bone} ${styles.chip}`} />
          <div className={`${styles.bone} ${styles.chip}`} />
          <div className={`${styles.bone} ${styles.chip}`} />
        </div>
        <div className={styles.tags}>
          <div className={`${styles.bone} ${styles.tag}`} />
          <div className={`${styles.bone} ${styles.tagWide}`} />
        </div>
      </div>
    </div>
  );
}
