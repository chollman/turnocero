import { Link } from "react-router-dom";
import styles from "./BackButton.module.css";

/**
 * Botón "volver" estándar de toda la web.
 *
 * Unifica el patrón del header de detalle de Mesas (mono, mayúsculas, flecha
 * `←` + texto, margen inferior de 20px). Antes cada sección tenía su propia
 * variante de `.backBtn` / `.backLink` / `.back` con tipografías y márgenes
 * distintos; ahora todas pasan por acá.
 *
 * Uso:
 *   <BackButton to="/eventos">Volver a eventos</BackButton>                 → <Link>
 *   <BackButton onClick={goBack} disabled={exiting}>Volver al listado</BackButton>  → <button>
 *
 * Props:
 *   to        — ruta destino; si está presente renderiza un <Link>.
 *   onClick   — handler; usado en modo <button> (navigate(-1), animación de salida…).
 *   disabled  — sólo aplica al modo <button>.
 *   flush     — sin margen inferior, para cuando el contenedor ya separa
 *               (una fila flex con acciones, o una columna con `gap`).
 *   children  — texto del botón (sin la flecha — la agregamos nosotros).
 */
export default function BackButton({
  to,
  onClick,
  disabled = false,
  flush = false,
  children = "Volver",
  className = "",
  ...rest
}) {
  const cls = [styles.backBtn, flush ? styles.flush : "", className]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span className={styles.arrow} aria-hidden="true">
        ←
      </span>
      {children}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {content}
    </button>
  );
}
