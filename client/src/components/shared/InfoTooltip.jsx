import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./InfoTooltip.module.css";

// Ícono "i" outlined, estilo Feather — matchea PinIcon/LockIcon/EyeIcon del codebase.
const InfoIcon = ({ size = 17 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

/**
 * Icono "ⓘ" inline que muestra un tooltip flotante con el contenido recibido.
 *
 * Comportamiento dual:
 * - Desktop (mouse): hover sobre el icono abre el tooltip; mouse-leave lo cierra.
 * - Mobile/touch: tap toggle. Tap fuera cierra. Escape también cierra.
 *
 * Uso:
 *   <label>
 *     Mi campo
 *     <InfoTooltip>
 *       Explicación del campo, puede tener <strong>HTML</strong>.
 *     </InfoTooltip>
 *   </label>
 *
 * Para accesibilidad: el icono es `<button>` (no `<span>`) para ser focusable
 * por teclado; en focus abre el tooltip vía `:focus-within`.
 *
 * @param {React.ReactNode} children   contenido del tooltip
 * @param {string}          label      aria-label del trigger (default "Más información")
 * @param {"top"|"bottom"}  placement  default "top"
 */
export default function InfoTooltip({
  children,
  label = "Más información",
  placement = "top",
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const tooltipRef = useRef(null);
  // Posición horizontal (px, relativa al wrapper) calculada al abrir, para
  // centrar el tooltip sobre el ícono PERO clampeado al viewport con margen.
  // Se setea con `left` REAL (no transform): un transform mueve sólo el render
  // y la caja de layout sin desplazar seguía generando scroll horizontal en la
  // página (ensanchaba el viewport en mobile). `null` = aún sin medir → oculto.
  const [leftPx, setLeftPx] = useState(null);
  useLayoutEffect(() => {
    if (!open) {
      setLeftPx(null);
      return;
    }
    const el = tooltipRef.current;
    const wrap = wrapperRef.current;
    if (!el || !wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    const width = el.offsetWidth;
    const margin = 16;
    const vw = document.documentElement.clientWidth;
    const triggerCenter = wrapRect.left + wrapRect.width / 2;
    // viewport-left deseado (centrado sobre el ícono), clampeado a [margin,
    // vw - margin - width]; si el tooltip es más ancho que el hueco, gana el
    // borde izquierdo.
    const maxLeft = Math.max(margin, vw - margin - width);
    const desired = Math.min(
      Math.max(triggerCenter - width / 2, margin),
      maxLeft,
    );
    setLeftPx(desired - wrapRect.left); // px relativo al wrapper
  }, [open, children]);
  // En touch, UN tap dispara mouseenter → focus → click (emulados): el
  // enter/focus abrían y el click togleaba → cerraba, y hacía falta un segundo
  // tap. Sellamos el instante del open "suave" (hover/focus) y el click del
  // MISMO gesto no togglea.
  const softOpenedAtRef = useRef(0);
  const openSoft = () => {
    if (!open) softOpenedAtRef.current = Date.now();
    setOpen(true);
  };

  // Cerrar al clickear afuera (caso mobile: se abrió por tap).
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  // Escape cierra.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      className={styles.wrapper}
      onMouseEnter={openSoft}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          // Toggle por click — útil para touch devices y como acción
          // explícita. Si este mismo gesto acaba de abrirlo (tap → enter/focus
          // emulados hace <500ms), no volver a togglear.
          if (Date.now() - softOpenedAtRef.current < 500) return;
          setOpen((prev) => !prev);
        }}
        onFocus={openSoft}
        onBlur={() => setOpen(false)}
      >
        <InfoIcon />
      </button>
      {open && (
        <span
          ref={tooltipRef}
          className={`${styles.tooltip} ${placement === "bottom" ? styles.tooltipBottom : styles.tooltipTop}`}
          role="tooltip"
          style={
            leftPx == null ? { visibility: "hidden" } : { left: `${leftPx}px` }
          }
        >
          {children}
        </span>
      )}
    </span>
  );
}
