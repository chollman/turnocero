import styles from './ProfileSkeleton.module.css'

export default function ProfileSkeleton() {
  return (
    <div aria-hidden="true" className={styles.page}>
      <div className={styles.banner} />
      <div className={styles.inner}>
        <div className={styles.backBtn} />
        <div className={styles.heroRow}>
          <div className={styles.avatar} />
          <div className={styles.heroInfo}>
            <div className={styles.eyebrow} />
            <div className={styles.title} />
            <div className={styles.sub} />
          </div>
        </div>
        <div className={styles.statsGrid}>
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className={styles.statCard} />
          ))}
        </div>
        <div className={styles.layout}>
          <div className={styles.col}>
            <div className={styles.infoCard} />
          </div>
          <div className={styles.col}>
            <div className={styles.infoCard} />
          </div>
        </div>
      </div>
    </div>
  )
}
