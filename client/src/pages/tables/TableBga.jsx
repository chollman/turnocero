import styles from "./TableBga.module.css";

// "Probá el juego online" — render condicional al lado de TableTutorials.
// Si el host configuró un URL de Board Game Arena en el Paso 5 "Extras",
// renderizamos una card CTA grande que abre el link en pestaña nueva.
//
// Sin estado, sin fetches — la URL ya viene validada del server (que
// la rechaza si no es boardgamearena.com). Si `bgaUrl` es null/empty,
// el componente se auto-oculta.
export default function TableBga({ boardGame, bgaUrl }) {
  if (!bgaUrl || typeof bgaUrl !== "string" || !bgaUrl.trim()) return null;

  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <span className={styles.sectionLabel}>◆ Probá el juego online</span>
        <span className={styles.sectionRule} />
      </header>
      <a
        href={bgaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.card}
      >
        <div className={styles.badge}>BGA</div>
        <div className={styles.body}>
          <h3 className={styles.title}>
            Jugá <strong>{boardGame || "este juego"}</strong> en Board Game
            Arena
          </h3>
          <p className={styles.sub}>
            El host sugirió esta página para que pruebes el juego online antes
            de la mesa.
          </p>
        </div>
        <span className={styles.arrow} aria-hidden="true">
          →
        </span>
      </a>
    </section>
  );
}
