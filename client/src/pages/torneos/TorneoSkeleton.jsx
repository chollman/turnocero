import styles from "./Torneos.module.css";

export default function TorneoSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonImg} />
      <div className={styles.skeletonBody}>
        <div className={styles.skeletonLine} style={{ width: "40%" }} />
        <div className={styles.skeletonLine} style={{ width: "70%" }} />
        <div className={styles.skeletonLine} style={{ width: "55%" }} />
        <div className={styles.skeletonChips}>
          <div className={styles.skeletonChip} />
          <div className={styles.skeletonChip} />
        </div>
      </div>
    </div>
  );
}
