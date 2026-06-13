import { useEffect, useRef, useState } from "react";
import styles from "./BgWatchProfile.module.css";

/**
 * Versión dropdown de las tabs de sección (Partidas / Colección / Jugadores /
 * Ubicaciones) para mobile — las 4 tabs con badge no entran cómodas en un
 * teléfono. En desktop se sigue usando la fila de tabs; este componente queda
 * oculto por CSS (`.tabSelect` es display:none salvo en --phone).
 */
export default function BgWatchTabSelect({ tabs, activeId, onSelect }) {
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

  const active = tabs.find((t) => t.id === activeId) || tabs[0];
  if (!active) return null;

  return (
    <div className={styles.tabSelect} ref={ref}>
      <button
        type="button"
        className={styles.tabSelectBtn}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.tabSelectCurrent}>
          {active.label}
          {active.badge != null && (
            <span className={styles.tabBadge}>{active.badge}</span>
          )}
        </span>
        <svg
          className={`${styles.tabSelectChevron} ${open ? styles.tabSelectChevronOpen : ""}`}
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
        <div className={styles.tabSelectPop} role="listbox">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="option"
              aria-selected={t.id === activeId}
              className={`${styles.tabSelectItem} ${t.id === activeId ? styles.tabSelectItemActive : ""}`}
              onClick={() => {
                setOpen(false);
                onSelect(t.id);
              }}
            >
              {t.label}
              {t.badge != null && (
                <span className={styles.tabBadge}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
