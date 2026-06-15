// Sanitización del HTML enriquecido (reseñas de Compartidas y cuerpo de Noticias).
//
// El body se guarda como HTML (el editor Tiptap del cliente lo produce).
// Sanitizamos al GUARDAR (acá) y el cliente vuelve a sanitizar al RENDERIZAR
// (`client/src/utils/sanitizeConfig.js` + RichTextContent) — doble barrera. El
// allow-list de ambos lados DEBE coincidir; si cambiás uno, cambiá el otro.

const DOMPurify = require("isomorphic-dompurify");

// ── Compartidas (reseñas) ──────────────────────────────────────────────────
// Nodos/marcas que el editor de reseñas puede producir.
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

// ── Noticias (cuerpo editorial) ────────────────────────────────────────────
// Superset del de reseñas: agrega h4, separador, código, alineación y embeds
// de YouTube. Mantener en sync con client/src/utils/sanitizeConfig.js.
const NOTICIA_ALLOWED_TAGS = [
  ...ALLOWED_TAGS,
  "h4",
  "hr",
  "code",
  "pre",
  "figure",
  "iframe",
];

// `style` se permite pero el hook lo reduce a `text-align`; `allow`/`sandbox`/
// etc. solo se usan en iframes de YouTube (validados por el hook).
const NOTICIA_ALLOWED_ATTR = [
  ...ALLOWED_ATTR,
  "style",
  "allow",
  "allowfullscreen",
  "frameborder",
  "width",
  "height",
  "sandbox",
  "title",
];

// Solo links http(s)/mailto — bloquea javascript:, data:, etc.
const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:)/i;

// Embeds permitidos: solo YouTube (dominio sin cookies), formato /embed/<id>.
const YT_EMBED_RE =
  /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{6,20}(\?[\w=&;-]*)?$/;
// Valores válidos para text-align (única declaración de estilo permitida).
const ALIGN_RE = /^(left|right|center|justify)$/;

// DOMPurify hook GLOBAL: blinda <a>, fuerza http(s) en <img>, reduce `style` a
// text-align y valida los <iframe> de embeds. Para el contenido de reseñas el
// hook es no-op extra (sus ALLOWED_TAGS/ATTR no incluyen style/iframe, así que
// esos nodos/atributos ya fueron removidos antes de este hook).
let hookRegistered = false;
function registerHook() {
  if (hookRegistered) return;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.getAttribute("href")) {
      node.setAttribute("rel", "noopener noreferrer nofollow");
      node.setAttribute("target", "_blank");
    }
    // DOMPurify permite `data:` en <img> por defecto. Forzamos solo http(s).
    if (node.tagName === "IMG") {
      const src = node.getAttribute("src") || "";
      if (!/^https?:\/\//i.test(src)) node.removeAttribute("src");
    }
    // `style`: conservar únicamente una declaración text-align válida.
    if (node.getAttribute && node.getAttribute("style") != null) {
      const style = node.getAttribute("style") || "";
      const m = style.match(/text-align\s*:\s*([a-z]+)/i);
      if (m && ALIGN_RE.test(m[1].toLowerCase())) {
        node.setAttribute("style", `text-align: ${m[1].toLowerCase()}`);
      } else {
        node.removeAttribute("style");
      }
    }
    // <iframe>: solo embeds de YouTube; cualquier otro src se elimina el nodo.
    if (node.tagName === "IFRAME") {
      const src = node.getAttribute("src") || "";
      if (!YT_EMBED_RE.test(src)) {
        node.parentNode?.removeChild(node);
        return;
      }
      // Atributos seguros forzados.
      [...node.attributes].forEach((attr) => {
        if (!["src", "width", "height", "title"].includes(attr.name)) {
          node.removeAttribute(attr.name);
        }
      });
      node.setAttribute("loading", "lazy");
      node.setAttribute("frameborder", "0");
      node.setAttribute(
        "allow",
        "accelerometer; encrypted-media; gyroscope; picture-in-picture",
      );
      node.setAttribute("allowfullscreen", "true");
      node.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-presentation",
      );
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

function sanitizeNoticiaHtml(dirty) {
  if (!dirty) return "";
  registerHook();
  return DOMPurify.sanitize(String(dirty), {
    ALLOWED_TAGS: NOTICIA_ALLOWED_TAGS,
    ALLOWED_ATTR: NOTICIA_ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    ADD_TAGS: ["iframe"],
  });
}

// Texto plano a partir de HTML — para previews/OG (descripciones, recortes).
function stripHtml(html) {
  if (!html) return "";
  // Sanitizar conservando algunos tags de bloque (así DOMPurify elimina el
  // CONTENIDO de <script>/<style>), luego convertir cada tag restante en un
  // espacio para no pegar el texto de bloques contiguos ("Hola"+"mundo").
  const safe = DOMPurify.sanitize(String(html), {
    ALLOWED_TAGS: ["br", "p", "h2", "h3", "h4", "li", "ul", "ol", "blockquote"],
    ALLOWED_ATTR: [],
  });
  return safe
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = {
  sanitizeCompartidaHtml,
  sanitizeNoticiaHtml,
  // Alias genérico del allow-list enriquecido (h4/hr/code/align/YouTube). Lo
  // comparten Noticias y las reseñas de Compartidas — mismo editor `extended`.
  sanitizeRichHtml: sanitizeNoticiaHtml,
  stripHtml,
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  NOTICIA_ALLOWED_TAGS,
  NOTICIA_ALLOWED_ATTR,
};
