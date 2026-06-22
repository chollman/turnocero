import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  children,
  className = "",
  ...rest
}) {
  const { t } = useTranslation();
  const cls = [styles.backBtn, flush ? styles.flush : "", className]
    .filter(Boolean)
    .join(" ");

  // El texto por defecto ("Volver") se resuelve acá, no en el param, porque
  // `t` no está disponible en la firma. Un `children` del caller gana.
  const label = children ?? t("common:actions.back");

  const content = (
    <>
      <span className={styles.arrow} aria-hidden="true">
        ←
      </span>
      {label}
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
