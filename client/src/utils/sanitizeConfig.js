// Allow-list de sanitización para el HTML enriquecido de las reseñas.
//
// DEBE coincidir con el del servidor (`server/utils/sanitizeHtml.js`). El
// servidor sanitiza al guardar y el cliente vuelve a sanitizar al renderizar
// (RichTextContent) — doble barrera. Si cambiás uno, cambiá el otro.

export const ALLOWED_TAGS = [
  "h2",
  "h3",
  "p",
  "strong",
  "em",
  "b",
  "i",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "br",
];

export const ALLOWED_ATTR = ["href", "target", "rel"];

export const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:)/i;

// Config lista para pasar a DOMPurify.sanitize(html, SANITIZE_CONFIG).
export const SANITIZE_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOWED_URI_REGEXP,
};
