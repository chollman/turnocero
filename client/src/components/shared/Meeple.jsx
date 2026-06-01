import styles from "./Meeple.module.css";

// Silueta de meeple (ficha de juego de mesa) — reemplaza al viejo glifo "◆"
// como motivo de marca de TurnoCero. SVG inline (sin libs de iconos), hereda
// el color via `currentColor` y escala con la tipografía del contexto (tamaño
// en `em`), así toma el mismo color que tenía el rombo en cada lugar.
//
// Props:
//  - className: clases extra (p. ej. para sobrescribir el tamaño por defecto).
//  - title:     si se pasa, el SVG deja de ser decorativo y expone role="img"
//               + <title> para lectores de pantalla.
export default function Meeple({ className = "", title }) {
  return (
    <svg
      className={`${styles.meeple} ${className}`}
      viewBox="0 0 512 440"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : "true"}
    >
      {title ? <title>{title}</title> : null}

      <path
        d="
      M256 40

      C220 40 195 65 195 105
      L195 125

      C155 135 115 150 95 180
      C82 200 88 235 125 240

      L155 240

      C145 260 138 280 130 300
      L105 395

      C102 412 112 425 128 425
      L205 425

      C217 425 225 420 232 408
      L256 365

      L280 408
      C287 420 295 425 307 425
      L384 425

      C400 425 410 412 407 395
      L382 300

      C374 280 367 260 357 240

      L387 240

      C424 235 430 200 417 180
      C397 150 357 135 317 125

      L317 105
      C317 65 292 40 256 40

      Z
    "
      />
    </svg>
  );
}
