import { useCallback, useRef } from "react";

// Patrón ARIA "radiogroup" con roving tabindex + navegación por flechas.
//
// Un grupo de `role="radio"` debe comportarse como una sola parada de tab: solo
// el radio seleccionado es tabbable (tabIndex 0), el resto tabIndex -1, y las
// flechas mueven la selección (←/↑ previo, →/↓ siguiente, con wrap; Home/End a
// los extremos). Sin esto, cada pill era una parada de tab y las flechas no
// hacían nada (los botones con role=radio prometen un contrato que no cumplían).
//
// Uso:
//   const group = useRovingRadioGroup({ items, value, onChange });
//   <div role="radiogroup">
//     {items.map((it, i) => (
//       <button {...group.getRadioProps(it, i)} onClick={() => onChange(it)}>…</button>
//     ))}
//   </div>
//
// `items` debe ser estable entre renders (definilo a nivel de módulo) para no
// recrear el handler en cada render.
export default function useRovingRadioGroup({ items, value, onChange }) {
  const refs = useRef([]);

  const onKeyDown = useCallback(
    (e, index) => {
      const deltas = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      let next;
      if (e.key in deltas) {
        next = (index + deltas[e.key] + items.length) % items.length;
      } else if (e.key === "Home") {
        next = 0;
      } else if (e.key === "End") {
        next = items.length - 1;
      } else {
        return;
      }
      e.preventDefault();
      onChange(items[next]);
      refs.current[next]?.focus();
    },
    [items, onChange],
  );

  // Si no hay selección todavía, el primer radio es el tabbable (entra al grupo).
  const selectedIndex = items.indexOf(value);
  const tabbableIndex = selectedIndex === -1 ? 0 : selectedIndex;

  const getRadioProps = (itemValue, index) => ({
    ref: (el) => {
      refs.current[index] = el;
    },
    role: "radio",
    "aria-checked": value === itemValue,
    tabIndex: index === tabbableIndex ? 0 : -1,
    onKeyDown: (e) => onKeyDown(e, index),
  });

  return { getRadioProps };
}
