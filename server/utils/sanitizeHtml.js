// Sanitización del HTML enriquecido de las reseñas.
//
// El body de una reseña se guarda como HTML (el editor Tiptap del cliente lo
// produce). Sanitizamos al GUARDAR (acá) y el cliente vuelve a sanitizar al
// RENDERIZAR (`client/src/utils/sanitizeConfig.js` + RichTextContent) — doble
// barrera. El allow-list de ambos lados DEBE coincidir; si cambiás uno,
// cambiá el otro.

const DOMPurify = require("isomorphic-dompurify");

// Nodos/marcas que el editor puede producir. Mantener en sync con el cliente.
const ALLOWED_TAGS = [
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
  "img",
];

const ALLOWED_ATTR = ["href", "target", "rel", "src", "alt"];

// Solo links http(s)/mailto — bloquea javascript:, data:, etc.
const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:)/i;

// DOMPurify hook: blindar todos los <a> con rel + target seguros.
let hookRegistered = false;
function registerHook() {
  if (hookRegistered) return;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.getAttribute("href")) {
      node.setAttribute("rel", "noopener noreferrer nofollow");
      node.setAttribute("target", "_blank");
    }
    // DOMPurify permite `data:` en <img> por defecto (no respeta el
    // ALLOWED_URI_REGEXP para imágenes). Forzamos solo http(s): si el src no
    // es http(s), lo quitamos.
    if (node.tagName === "IMG") {
      const src = node.getAttribute("src") || "";
      if (!/^https?:\/\//i.test(src)) node.removeAttribute("src");
    }
  });
  hookRegistered = true;
}

function sanitizeCompartidaHtml(dirty) {
  if (!dirty) return "";
  registerHook();
  return DOMPurify.sanitize(String(dirty), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
  });
}

// Texto plano a partir de HTML — para previews/OG (descripciones, recortes).
function stripHtml(html) {
  if (!html) return "";
  // Sanitizar conservando algunos tags de bloque (así DOMPurify elimina el
  // CONTENIDO de <script>/<style>), luego convertir cada tag restante en un
  // espacio para no pegar el texto de bloques contiguos ("Hola"+"mundo").
  const safe = DOMPurify.sanitize(String(html), {
    ALLOWED_TAGS: ["br", "p", "h2", "h3", "li", "ul", "ol", "blockquote"],
    ALLOWED_ATTR: [],
  });
  return safe
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = {
  sanitizeCompartidaHtml,
  stripHtml,
  ALLOWED_TAGS,
  ALLOWED_ATTR,
};
