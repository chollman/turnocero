import styles from "./TableDetailSkeleton.module.css";

export default function TableDetailSkeleton() {
  return (
    <div aria-hidden="true" className={styles.page}>
      <div className="container">
        <div className={styles.hero} />
        <div className={styles.body}>
          <div className={styles.topRow}>
            <div className={styles.title} />
            <div className={styles.badge} />
          </div>
          <div className={styles.subtitle} />
          <div className={styles.chips}>
            <div className={styles.chip} />
            <div className={styles.chip} />
            <div className={styles.chip} />
          </div>
          <div className={styles.tabs}>
            <div className={styles.tab} />
            <div className={styles.tab} />
            <div className={styles.tab} />
          </div>
          <div className={styles.line} />
          <div className={styles.lineShort} />
          <div className={styles.line} />
        </div>
      </div>
    </div>
  );
}
