import styles from "./TableDetailSkeleton.module.css";

// Skeleton del detalle de mesa. Espeja la estructura real de TableDetail:
// back button, layout grid (main 1fr + aside 360px sticky en desktop),
// banner editorial 21:8, metaRow de 4 celdas, dos secciones con sectionHead
// y un ticket-stub placeholder en el aside. En mobile el grid colapsa
// (1 col, banner 16:9, aside abajo) — manejado por las media queries.
export default function TableDetailSkeleton() {
  return (
    <div aria-hidden="true" className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.backBtn} />

        <div className={styles.layout}>
          <main className={styles.main}>
            <div className={styles.banner}>
              <div className={styles.bannerOverlay} />
              <div className={styles.bannerEyebrow} />
              <div className={styles.bannerTitle} />
              <div className={styles.bannerDate} />
            </div>

            <div className={styles.metaRow}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={styles.metaCell}>
                  <div className={styles.metaLabel} />
                  <div className={styles.metaValue} />
                  <div className={styles.metaAccent} />
                </div>
              ))}
            </div>

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <div className={styles.sectionLabel} />
                <div className={styles.sectionRule} />
              </div>
              <div className={styles.line} />
              <div className={`${styles.line} ${styles.lineShort}`} />
              <div className={styles.line} />
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <div className={styles.sectionLabel} />
                <div className={styles.sectionRule} />
                <div className={styles.sectionCount} />
              </div>
              <div className={styles.tableMapWrap}>
                <div className={styles.tableMap} />
                <div className={styles.playersList}>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={styles.playerRow}>
                      <div className={styles.playerAvatar} />
                      <div className={styles.playerInfo}>
                        <div className={styles.playerName} />
                        <div className={styles.playerHandle} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </main>

          <aside className={styles.aside}>
            <div className={styles.stub}>
              <div className={styles.stubLabel} />
              <div className={styles.stubGame} />
              <div className={styles.stubMeta} />
              <div className={styles.stubMeta} />
              <div className={styles.stubDivider} />
              <div className={styles.stubCta} />
            </div>
            <div className={styles.secondaryActions}>
              <div className={styles.secondaryBtn} />
              <div className={styles.secondaryBtn} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
