import styles from "./SearchRowSkeleton.module.css";

/**
 * Skeleton de filas para los selectores paginados de BG Watch (MyGamesPicker,
 * LocationPicker, PlayerPicker) mientras se busca/carga. Cada fila replica la
 * forma de `gameSearchItem` (cuadrado ~40px + dos líneas de texto), así el
 * loader ocupa el mismo tamaño que los resultados que está por mostrar.
 *
 * Props:
 *   rows — cantidad de filas fantasma (default 4).
 */
export default function SearchRowSkeleton({ rows = 4 }) {
  return (
    <div
      className={styles.list}
      aria-hidden="true"
      data-testid="search-skeleton"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles.row}>
          <div className={`${styles.bone} ${styles.thumb}`} />
          <div className={styles.info}>
            <div className={`${styles.bone} ${styles.line1}`} />
            <div className={`${styles.bone} ${styles.line2}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
