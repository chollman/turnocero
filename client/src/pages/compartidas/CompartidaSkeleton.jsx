import styles from "./CompartidaSkeleton.module.css";

export default function CompartidaSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={styles.header}>
        <div className={`${styles.bone} ${styles.avatar}`} />
        <div className={styles.authorMeta}>
          <div className={`${styles.bone} ${styles.name}`} />
          <div className={`${styles.bone} ${styles.time}`} />
        </div>
      </div>

      <div className={`${styles.bone} ${styles.title}`} />

      <div className={styles.bodyLines}>
        <div className={`${styles.bone} ${styles.lineFull}`} />
        <div className={`${styles.bone} ${styles.lineWide}`} />
        <div className={`${styles.bone} ${styles.lineMid}`} />
      </div>

      <div className={styles.footer}>
        <div className={`${styles.bone} ${styles.footerBtn}`} />
        <div className={`${styles.bone} ${styles.footerBtn}`} />
        <div className={`${styles.bone} ${styles.footerShare}`} />
      </div>
    </div>
  );
}
