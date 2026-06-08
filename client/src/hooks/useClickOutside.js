import { useEffect, useRef } from "react";

// Cierra/dispara algo cuando hay un `mousedown` FUERA del elemento referenciado.
// Reemplaza el patrón repetido de `useEffect` + listener manual de document
// (popovers de PlayForm, dropdown de LocationPicker, etc.).
//
//   const ref = useRef(null);
//   useClickOutside(ref, () => setOpen(false), open);
//
// - `ref`: ref al contenedor; un click adentro NO dispara.
// - `onOutside`: callback (recibe el evento). Se guarda en un ref para no
//   re-suscribir el listener en cada render aunque se pase una función inline.
// - `enabled`: sólo escucha mientras es true (típicamente el estado "abierto").
export default function useClickOutside(ref, onOutside, enabled = true) {
  const cbRef = useRef(onOutside);
  // Mantener el callback fresco sin re-suscribir el listener. Se actualiza en un
  // effect (no en render) para no escribir el ref durante el render.
  useEffect(() => {
    cbRef.current = onOutside;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) cbRef.current(e);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, enabled]);
}
