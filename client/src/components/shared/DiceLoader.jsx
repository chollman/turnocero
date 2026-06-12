import styles from "./DiceLoader.module.css";

/**
 * Loader animado para buscadores tipo dropdown (BGG, jugadores, ubicaciones…):
 * un dado que "rueda" (cambia de cara 1→6) + puntos rebotando + hint opcional
 * dejan claro que hay que esperar, mucho mejor que un "Buscando…" estático.
 * Para esperas largas contra BGG, pasar hint="puede tardar unos segundos".
 *
 * Los pips del d6 van en grilla 3×3 y comparten 4 timelines de visibilidad
 * (A=centro, B=diagonal corta, C=diagonal larga, D=laterales) que combinadas
 * forman las caras 1..6 en secuencia.
 *
 * Props:
 *   text — mensaje principal (default "Buscando").
 *   hint — aclaración chica debajo (default sin hint).
 */
export default function DiceLoader({ text = "Buscando", hint = "" }) {
  return (
    <div className={styles.wrap} role="status">
      <svg className={styles.die} viewBox="0 0 48 48" aria-hidden="true">
        <rect
          className={styles.face}
          x="5"
          y="5"
          width="38"
          height="38"
          rx="10"
        />
        <circle
          className={`${styles.pip} ${styles.pipA}`}
          cx="24"
          cy="24"
          r="3.4"
        />
        <circle
          className={`${styles.pip} ${styles.pipB}`}
          cx="33"
          cy="15"
          r="3.4"
        />
        <circle
          className={`${styles.pip} ${styles.pipB}`}
          cx="15"
          cy="33"
          r="3.4"
        />
        <circle
          className={`${styles.pip} ${styles.pipC}`}
          cx="15"
          cy="15"
          r="3.4"
        />
        <circle
          className={`${styles.pip} ${styles.pipC}`}
          cx="33"
          cy="33"
          r="3.4"
        />
        <circle
          className={`${styles.pip} ${styles.pipD}`}
          cx="15"
          cy="24"
          r="3.4"
        />
        <circle
          className={`${styles.pip} ${styles.pipD}`}
          cx="33"
          cy="24"
          r="3.4"
        />
      </svg>
      <div className={styles.texts}>
        <span className={styles.text}>
          {text}
          <span className={styles.dots} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>
    </div>
  );
}
