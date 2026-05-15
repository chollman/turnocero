import styles from './FeedCardSkeleton.module.css'

export default function FeedCardSkeleton() {
  return (
    <div aria-hidden="true" className={styles.card}>
      <div className={styles.tile} />
      <div className={styles.body}>
        <div className={styles.topRow}>
          <div className={styles.title} />
          <div className={styles.badge} />
        </div>
        <div className={styles.meta} />
      </div>
      <div className={styles.btn} />
    </div>
  )
}
