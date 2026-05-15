import styles from './TableCardSkeleton.module.css'

export default function TableCardSkeleton() {
  return (
    <div aria-hidden="true" className={styles.card}>
      <div className={styles.banner} />
      <div className={styles.body}>
        <div className={styles.topRow}>
          <div className={styles.title} />
          <div className={styles.badge} />
        </div>
        <div className={styles.subtitle} />
        <div className={styles.chip} />
      </div>
      <div className={styles.footer}>
        <div className={styles.avatars}>
          <div className={styles.avatar} />
          <div className={styles.avatar} />
          <div className={styles.avatar} />
        </div>
        <div className={styles.joinBtn} />
      </div>
    </div>
  )
}
