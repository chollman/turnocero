import { useEffect, useRef, useState } from "react";
import bg from "./BgWatchProfile.module.css";
import styles from "./PlayForm.module.css";

// Badge del número de posición (derivado del puntaje) con un glitch cyberpunk
// que se dispara SOLO cuando el número cambia, no en el montaje inicial del
// form. Cada cambio incrementa `nonce`, que keyea el <span> para remontarlo y
// re-disparar el keyframe (un atributo/clase que ya está aplicado no reinicia
// la animación). `nonce` arranca en 0 → sin glitch al cargar.
//
// El estado se expone en `data-glitch` (no en una clase de CSS-module hasheada)
// para que tanto el estilo como los tests lo lean de forma estable.
export default function PositionBadge({ position }) {
  const prev = useRef(position);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (prev.current !== position) {
      prev.current = position;
      setNonce((n) => n + 1);
    }
  }, [position]);

  return (
    <span
      key={nonce}
      className={`${bg.playerEditPos} ${styles.posBadge}`}
      data-glitch={nonce > 0 ? "on" : undefined}
      title="Posición (según el puntaje)"
    >
      {position}
    </span>
  );
}
