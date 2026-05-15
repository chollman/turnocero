import styles from './UsersListSkeleton.module.css'

export default function UsersListSkeleton() {
  return (
    <div aria-hidden="true" className={styles.card}>
      <div className={styles.avatar} />
      <div className={styles.body}>
        <div className={styles.username} />
        <div className={styles.name} />
        <div className={styles.chip} />
      </div>
      <div className={styles.stats}>
        <div className={styles.statBlock} />
        <div className={styles.divider} />
        <div className={styles.statBlock} />
      </div>
    </div>
  )
}
