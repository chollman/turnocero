import styles from './EventoSkeleton.module.css'

export default function EventoSkeleton() {
  return (
    <div className={styles.card}>
      <div className={styles.image} />
      <div className={styles.body}>
        <div className={styles.badges}>
          <div className={`${styles.line} ${styles.badge}`} />
          <div className={`${styles.line} ${styles.badge}`} />
        </div>
        <div className={`${styles.line} ${styles.title}`} />
        <div className={`${styles.line} ${styles.meta}`} />
        <div className={`${styles.line} ${styles.desc}`} />
      </div>
    </div>
  )
}
