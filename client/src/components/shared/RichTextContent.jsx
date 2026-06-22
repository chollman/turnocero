import { useMemo, useState, useCallback } from "react";
import DOMPurify from "dompurify";
import { useTranslation } from "react-i18next";
import Modal from "./Modal";
import {
  SANITIZE_CONFIG,
  NOTICIA_SANITIZE_CONFIG,
  registerNoticiaHook,
} from "../../utils/sanitizeConfig";
import styles from "./RichTextContent.module.css";

/**
 * Renderiza HTML enriquecido, sanitizado en cliente.
 *
 * El servidor ya sanitiza al guardar, pero re-sanitizamos al renderizar como
 * defensa en profundidad (mismo allow-list — `utils/sanitizeConfig.js`).
 *
 * Las imágenes del cuerpo se topan en 500px de alto (CSS) y, si quedan
 * escaladas, se pueden clickear para abrirlas a tamaño real en un lightbox.
 *
 * Props:
 *   html: string — HTML a renderizar.
 *   className?: string — clase extra para el contenedor.
 *   extended?: boolean — usa el allow-list de Noticias (h4, hr, code, align,
 *                        embeds de YouTube) en vez del de reseñas.
 */
export default function RichTextContent({
  html,
  className = "",
  extended = false,
}) {
  const { t } = useTranslation();
  const [lightbox, setLightbox] = useState(null);

  const clean = useMemo(() => {
    if (extended) registerNoticiaHook(DOMPurify);
    return DOMPurify.sanitize(
      html || "",
      extended ? NOTICIA_SANITIZE_CONFIG : SANITIZE_CONFIG,
    );
  }, [html, extended]);

  // Click en una imagen escalada (más alta/ancha que lo que se muestra) → abrir
  // a tamaño real. Las imágenes chicas (ya mostradas a tamaño real) no hacen nada.
  const handleClick = useCallback((e) => {
    const img = e.target?.closest?.("img");
    if (!img || !img.src) return;
    const scaled =
      img.naturalHeight > img.clientHeight + 1 ||
      img.naturalWidth > img.clientWidth + 1;
    if (scaled) setLightbox(img.currentSrc || img.src);
  }, []);

  if (!clean) return null;

  return (
    <>
      <div
        className={`${styles.content} ${className}`.trim()}
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: clean }}
      />
      {lightbox && (
        <Modal
          isOpen={!!lightbox}
          onClose={() => setLightbox(null)}
          ariaLabel={t("shared:richTextContent.lightboxAria")}
          className={styles.lightbox}
          backdropClassName={styles.lightboxBackdrop}
        >
          <img
            src={lightbox}
            alt=""
            className={styles.lightboxImg}
            onClick={() => setLightbox(null)}
          />
        </Modal>
      )}
    </>
  );
}
