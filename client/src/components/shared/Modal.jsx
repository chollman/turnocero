import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Modal accesible:
//   - role="dialog" + aria-modal="true"
//   - Escape para cerrar
//   - Click en backdrop para cerrar (opt-out via dismissOnBackdrop=false)
//   - Focus inicial al contenedor; restaura al elemento que tenía focus al abrir
//
// No es un "ConfirmModal" — es bajo nivel. Layoutea con `children` y
// estiliza con `className`. Para confirmaciones, ver ConfirmModal.
export default function Modal({
  isOpen,
  onClose,
  ariaLabel,
  ariaLabelledBy,
  className,
  backdropClassName,
  dismissOnBackdrop = true,
  children,
}) {
  const contentRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    // Guardar foco previo y enfocar el contenedor del modal. Browsers
    // necesitan tabIndex en el div para que sea focusable programáticamente.
    previouslyFocusedRef.current = document.activeElement;
    contentRef.current?.focus();

    function handleKey(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      }
    }
    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("keydown", handleKey);
      // Restaurar foco al elemento previo solo si sigue en el DOM.
      const prev = previouslyFocusedRef.current;
      if (prev && document.contains(prev)) {
        prev.focus?.();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Portal a document.body para escapar de ancestros que crean containing
  // block para `position: fixed` (transform / will-change / filter / contain
  // / etc.) y/o tienen `overflow: clip|hidden`. Sin esto, el backdrop fixed
  // se clippea al box del ancestro (visible en EventoDetail .main).
  return createPortal(
    <div
      className={backdropClassName}
      onClick={() => {
        if (dismissOnBackdrop) onClose?.();
      }}
      role="presentation"
    >
      <div
        ref={contentRef}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
