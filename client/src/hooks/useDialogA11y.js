import { useEffect, useRef } from "react";

// Manejo de foco para diálogos overlay (lightbox de fotos, etc.): al abrir
// guarda el elemento que tenía el foco y mueve el foco al contenedor; al cerrar
// lo restaura (solo si sigue en el DOM). Devuelve un ref para el contenedor,
// que debe declarar `tabIndex={-1}` para ser focusable programáticamente.
//
// Espeja el comportamiento de focus de `components/shared/Modal.jsx` para los
// overlays que no usan ese componente (los lightboxes tienen su propio layout
// full-screen + navegación con flechas).
export default function useDialogA11y(isOpen) {
  const ref = useRef(null);
  const prevFocusRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    prevFocusRef.current = document.activeElement;
    ref.current?.focus();
    return () => {
      const prev = prevFocusRef.current;
      if (prev && document.contains(prev)) prev.focus?.();
    };
  }, [isOpen]);

  return ref;
}
