import { Link } from "react-router-dom";
import Meeple from "./Meeple";
import styles from "./EmptyState.module.css";

// ─── Action icons (inline SVG — no hay libs de iconos en el proyecto) ───
const ICONS = {
  plus: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  compass: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  ),
  clear: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  search: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
};

// `icon` puede ser: una clave del registro ('plus'|'compass'|'clear'|'search'),
// un ReactNode propio, o null/'none' para no mostrar ninguno. `undefined` cae
// al default según el rol del botón.
function resolveIcon(icon, fallback) {
  if (icon === null || icon === "none") return null;
  if (icon === undefined) return fallback ? ICONS[fallback] : null;
  if (typeof icon === "string") return ICONS[icon] || null;
  return icon;
}

function Action({ action, kind }) {
  if (!action) return null;
  const isPrimary = kind === "primary";
  const icon = resolveIcon(action.icon, isPrimary ? "plus" : "compass");
  const className = isPrimary
    ? styles.emptyBtn
    : `${styles.emptyBtn} ${styles.ghost}`;
  if (action.to) {
    return (
      <Link to={action.to} className={className}>
        {icon}
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={action.onClick}>
      {icon}
      {action.label}
    </button>
  );
}

/**
 * Estado vacío reutilizable de TurnoCero.
 *
 * Dos modos (NO confundir):
 *  - `first`    → primera vez / sin datos. Ilustración grande, ghost previews
 *                 detrás, CTA primario que invita a crear.
 *  - `filtered` → búsqueda/filtro sin resultados. Compacto, lupa, chips de
 *                 sugerencia (con counts reales) + "Limpiar filtros". Sin ghosts.
 *
 * Props:
 *  - variant: 'first' | 'filtered' (default 'first')
 *  - art: ReactNode — ilustración SVG (ver EmptyArt)
 *  - ghost: ReactNode | null — ghost previews (sólo `first`; ver EmptyGhosts)
 *  - eyebrow: string — mono uppercase (lleva viñeta meeple en `first`)
 *  - title: ReactNode — admite <em> (acento cyan)
 *  - text: string — copy de apoyo
 *  - primary / secondary: { label, icon?, to?, onClick? } — CTA / acción ghost
 *  - chips: Array<{ label, count?, onClick }> — sugerencias (filtered)
 *  - hint: ReactNode — línea de ayuda opcional (mono)
 *  - compact: boolean — menos altura (true en filtered)
 */
export default function EmptyState({
  variant = "first",
  art,
  ghost = null,
  eyebrow,
  title,
  text,
  primary,
  secondary,
  chips,
  hint,
  compact = false,
}) {
  const isFiltered = variant === "filtered";
  // En filtered no hay ghosts (no hay nada que previsualizar).
  const ghostNode = isFiltered ? null : ghost;

  return (
    <div
      className={`${styles.empty} ${compact ? styles.compact : ""}`}
      role="status"
      aria-live="polite"
    >
      {ghostNode}
      <div className={styles.emptyCore}>
        {art && (
          <div className={styles.emptyArt} aria-hidden="true">
            {art}
          </div>
        )}
        {eyebrow && (
          <span
            className={`${styles.emptyEyebrow} ${isFiltered ? styles.muted : ""}`}
          >
            {!isFiltered && <Meeple className={styles.eyebrowMeeple} />}
            {eyebrow}
          </span>
        )}
        {title && <h2 className={styles.emptyTitle}>{title}</h2>}
        {text && <p className={styles.emptyText}>{text}</p>}
        {(primary || secondary) && (
          <div className={styles.emptyActions}>
            <Action action={primary} kind="primary" />
            <Action action={secondary} kind="secondary" />
          </div>
        )}
        {chips && chips.length > 0 && (
          <div className={styles.emptyChips}>
            {chips.map((c) => (
              <button
                key={c.label}
                type="button"
                className={styles.emptyChip}
                onClick={c.onClick}
              >
                {c.label}
                {typeof c.count === "number" && c.count > 0 && (
                  <span className={styles.emptyChipCount}>· {c.count}</span>
                )}
              </button>
            ))}
          </div>
        )}
        {hint && <div className={styles.emptyHint}>{hint}</div>}
      </div>
    </div>
  );
}
