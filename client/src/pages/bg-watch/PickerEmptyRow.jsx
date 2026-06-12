import styles from "./BgWatchProfile.module.css";

/**
 * Fila compacta de estado vacío para los pickers de BG Watch (juegos,
 * expansiones): ocupa el mismo alto que el <DiceLoader>, en vez del bloque
 * grande del <EmptyState>. El texto (sin coincidencias / lista vacía) lo
 * decide cada picker y se pasa como children.
 */
export default function PickerEmptyRow({ children }) {
  return (
    <div className={styles.pickerNoMatch} role="status">
      {children}
    </div>
  );
}
