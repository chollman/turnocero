import styles from "./GameCardSkeleton.module.css";

export default function GameCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={`${styles.bone} ${styles.thumb}`} />
      <div className={styles.info}>
        <div className={`${styles.bone} ${styles.title}`} />
        <div className={`${styles.bone} ${styles.year}`} />
        <div className={styles.ratings}>
          <div className={`${styles.bone} ${styles.rating}`} />
          <div className={`${styles.bone} ${styles.rating}`} />
          <div className={`${styles.bone} ${styles.rating}`} />
        </div>
      </div>
    </div>
  );
}
