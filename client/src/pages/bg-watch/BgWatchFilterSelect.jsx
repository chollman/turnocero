import { useEffect, useRef, useState } from "react";
import styles from "./BgWatchProfile.module.css";

/**
 * Versión dropdown de los chips de filtro de fecha (Todas / Este año / Este mes
 * / 7 días) para mobile — así entran en la misma fila que "Actualizado…" en vez
 * de ocupar una fila propia con scroll horizontal. En desktop se siguen usando
 * los chips; este componente queda oculto por CSS (`.filterSelect` es
 * display:none salvo en --phone).
 */
export default function BgWatchFilterSelect({ filters, activeId, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = filters.find((f) => f.id === activeId) || filters[0];
  if (!active) return null;

  return (
    <div className={styles.filterSelect} ref={ref}>
      <button
        type="button"
        className={styles.filterSelectBtn}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.filterSelectCurrent}>{active.label}</span>
        <svg
          className={`${styles.filterSelectChevron} ${open ? styles.filterSelectChevronOpen : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className={styles.filterSelectPop} role="listbox">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              role="option"
              aria-selected={f.id === activeId}
              className={`${styles.filterSelectItem} ${f.id === activeId ? styles.filterSelectItemActive : ""}`}
              onClick={() => {
                setOpen(false);
                onSelect(f.id);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
