import styles from "./EventoSkeleton.module.css";

// Placeholder de carga del listado de eventos. Dos variantes que espejan
// los componentes reales:
// - "timeline" → TimelineRow (fecha sticky a la izquierda, dot,
//   badges + título + meta + descripción + host-line, columna derecha
//   con fee + cupos + CTA).
// - "poster"   → PosterCard (afiche cinematográfico 3:4 con date overlay
//   top-left, status top-right, body abajo con título + meta + fee + CTA).
export default function EventoSkeleton({ variant = "timeline" }) {
  if (variant === "poster") {
    return (
      <div className={styles.poster}>
        <div className={styles.posterImg} />
        <div className={styles.posterOverlay} />
        <div className={styles.posterDate}>
          <div className={`${styles.line} ${styles.posterDateDay}`} />
          <div className={`${styles.line} ${styles.posterDateMonth}`} />
        </div>
        <div className={styles.posterStatusWrap}>
          <div className={`${styles.line} ${styles.posterStatus}`} />
        </div>
        <div className={styles.posterBody}>
          <div className={`${styles.line} ${styles.posterTitle}`} />
          <div className={styles.posterMetaRow}>
            <div className={`${styles.line} ${styles.posterMetaItem}`} />
            <div className={`${styles.line} ${styles.posterMetaItem}`} />
          </div>
          <div className={styles.posterBottom}>
            <div className={`${styles.line} ${styles.posterFee}`} />
            <div className={`${styles.line} ${styles.posterCta}`} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.row}>
      <div className={styles.date}>
        <div className={`${styles.line} ${styles.dateWeekday}`} />
        <div className={`${styles.line} ${styles.dateDay}`} />
        <div className={`${styles.line} ${styles.dateTime}`} />
      </div>
      <div className={styles.dot} />
      <div className={styles.content}>
        <div className={styles.badges}>
          <div className={`${styles.line} ${styles.badge}`} />
          <div className={`${styles.line} ${styles.badge}`} />
        </div>
        <div className={`${styles.line} ${styles.title}`} />
        <div className={styles.metaRow}>
          <div className={`${styles.line} ${styles.metaItem}`} />
          <div className={`${styles.line} ${styles.metaItem}`} />
        </div>
        <div className={`${styles.line} ${styles.desc}`} />
        <div className={styles.hostLine}>
          <div className={`${styles.line} ${styles.hostAvatar}`} />
          <div className={`${styles.line} ${styles.hostName}`} />
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.fee}>
          <div className={`${styles.line} ${styles.feeLabel}`} />
          <div className={`${styles.line} ${styles.feeValue}`} />
        </div>
        <div className={styles.cupos}>
          <div className={`${styles.line} ${styles.cuposBar}`} />
          <div className={`${styles.line} ${styles.cuposText}`} />
        </div>
        <div className={`${styles.line} ${styles.cta}`} />
      </div>
    </div>
  );
}
