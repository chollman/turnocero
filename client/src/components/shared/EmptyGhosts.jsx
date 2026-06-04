// Ghost previews por layout — skeletons "fantasma" del card real de cada
// sección, desvanecidos detrás del prompt del EmptyState (máscara radial +
// opacity en `.emptyGhosts`). Puramente decorativos (`pointer-events: none`),
// se ocultan en mobile (≤640px). Sólo se usan en la variante `first`.
import styles from "./EmptyState.module.css";

// 4 cards (banner + líneas + track + avatar/pill) → grids de cards (Mesas).
export function GhostMesa() {
  return (
    <div className={styles.emptyGhosts} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={styles.ghostCard}>
          <div className={styles.ghostBanner} />
          <div className={styles.ghostBody}>
            <div className={`${styles.ghostLine} ${styles.tall} ${styles.w70}`} />
            <div className={`${styles.ghostLine} ${styles.w50}`} />
            <div className={styles.ghostTrack} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <div
                className={styles.ghostAvatar}
                style={{ width: 26, height: 26 }}
              />
              <div className={styles.ghostPill} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// 4 filas (fecha + líneas + pill) → timelines/listas (Eventos, Torneos).
export function GhostRows() {
  return (
    <div className={`${styles.emptyGhosts} ${styles.rows}`} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={styles.ghostRowCard}>
          <div className={styles.ghostDate} />
          <div className={styles.ghostRowBody}>
            <div className={`${styles.ghostLine} ${styles.tall} ${styles.w50}`} />
            <div className={`${styles.ghostLine} ${styles.w90}`} />
          </div>
          <div className={styles.ghostPill} />
        </div>
      ))}
    </div>
  );
}

// 5 polaroids rotadas → Compartidas.
export function GhostPolaroids() {
  return (
    <div className={styles.emptyGhosts} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={styles.ghostPolaroid}>
          <div className={styles.ghostPolaroidPhoto} />
        </div>
      ))}
    </div>
  );
}

// 4 carnets (franja color + avatar redondo + stats) → Comunidad.
export function GhostMembers() {
  return (
    <div className={styles.emptyGhosts} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`${styles.ghostCard} ${styles.tall}`}>
          <div className={styles.ghostMemberStrip} />
          <div className={styles.ghostBody}>
            <div className={styles.ghostMemberHead}>
              <div className={`${styles.ghostAvatar} ${styles.round}`} />
              <div className={styles.ghostMemberHeadLines}>
                <div
                  className={`${styles.ghostLine} ${styles.tall} ${styles.w70}`}
                />
                <div className={`${styles.ghostLine} ${styles.w40}`} />
              </div>
            </div>
            <div
              className={`${styles.ghostLine} ${styles.w90}`}
              style={{ marginTop: 6 }}
            />
            <div className={styles.ghostMemberStats}>
              <div className={styles.ghostPill} />
              <div className={styles.ghostPill} />
              <div className={styles.ghostPill} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
