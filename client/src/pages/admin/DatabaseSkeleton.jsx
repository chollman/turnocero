import styles from "./DatabaseSkeleton.module.css";

const COLS = [200, 120, 160, 100, 140, 90];
const ROWS = 8;

export default function DatabaseSkeleton() {
  return (
    <div aria-hidden="true" className={styles.wrap}>
      <div className={styles.tableWrap}>
        <div className={styles.thead}>
          {COLS.map((w, i) => (
            <div key={i} className={styles.th} style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: ROWS }).map((_, r) => (
          <div key={r} className={styles.row}>
            {COLS.map((w, i) => (
              <div key={i} className={styles.td} style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
