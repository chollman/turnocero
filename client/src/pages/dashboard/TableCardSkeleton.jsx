import styles from "./TableCardSkeleton.module.css";

// Placeholder de carga de la grilla de mesas. La estructura espeja el
// TableCard nuevo (banner 16:7 con dateChip + badge → game title →
// location line → seat section con track → foot con host + CTA), así el
// shimmer no salta cuando se reemplaza por la card real.
export default function TableCardSkeleton() {
  return (
    <div aria-hidden="true" className={styles.card}>
      <div className={styles.banner}>
        <div className={styles.dateChip} />
        <div className={styles.bannerBadge} />
      </div>
      <div className={styles.body}>
        <div className={styles.game} />
        <div className={styles.location} />
        <div className={styles.seatSection}>
          <div className={styles.seatHead}>
            <div className={styles.seatLabel} />
            <div className={styles.seatCount} />
          </div>
          <div className={styles.seatTrack} />
        </div>
        <div className={styles.foot}>
          <div className={styles.hostBlock}>
            <div className={styles.avatar} />
            <div className={styles.hostInfo}>
              <div className={styles.hostLabel} />
              <div className={styles.hostName} />
            </div>
          </div>
          <div className={styles.cta} />
        </div>
      </div>
    </div>
  );
}
