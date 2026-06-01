import { useMemo } from "react";
import DOMPurify from "dompurify";
import { SANITIZE_CONFIG } from "../../utils/sanitizeConfig";
import styles from "./RichTextContent.module.css";

/**
 * Renderiza el HTML enriquecido de una reseña, sanitizado en cliente.
 *
 * El servidor ya sanitiza al guardar, pero re-sanitizamos al renderizar como
 * defensa en profundidad (mismo allow-list — `utils/sanitizeConfig.js`).
 *
 * Props:
 *   html: string — HTML de la reseña.
 *   className?: string — clase extra para el contenedor.
 */
export default function RichTextContent({ html, className = "" }) {
  const clean = useMemo(
    () => DOMPurify.sanitize(html || "", SANITIZE_CONFIG),
    [html],
  );

  if (!clean) return null;

  return (
    <div
      className={`${styles.content} ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
