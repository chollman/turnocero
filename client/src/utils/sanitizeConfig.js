// Allow-list de sanitización para el HTML enriquecido.
//
// DEBE coincidir con el del servidor (`server/utils/sanitizeHtml.js`). El
// servidor sanitiza al guardar y el cliente vuelve a sanitizar al renderizar
// (RichTextContent) — doble barrera. Si cambiás uno, cambiá el otro.

// ── Compartidas (reseñas) ──────────────────────────────────────────────────
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
  "img",
];

export const ALLOWED_ATTR = ["href", "target", "rel", "src", "alt"];

export const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:)/i;

// Config lista para pasar a DOMPurify.sanitize(html, SANITIZE_CONFIG).
export const SANITIZE_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOWED_URI_REGEXP,
};

// ── Noticias (cuerpo editorial) ────────────────────────────────────────────
// Superset: agrega h4, separador, código, alineación y embeds de YouTube.
export const NOTICIA_ALLOWED_TAGS = [
  ...ALLOWED_TAGS,
  "h4",
  "hr",
  "code",
  "pre",
  "figure",
  "iframe",
];

export const NOTICIA_ALLOWED_ATTR = [
  ...ALLOWED_ATTR,
  "style",
  "allow",
  "allowfullscreen",
  "frameborder",
  "width",
  "height",
  "sandbox",
  "title",
  "loading",
];

const YT_EMBED_RE =
  /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{6,20}(\?[\w=&;-]*)?$/;
const ALIGN_RE = /^(left|right|center|justify)$/;

// El hook del cliente espeja al del server: reduce style→text-align y valida
// los iframes de YouTube. Se registra una sola vez (idempotente).
let hookRegistered = false;
export function registerNoticiaHook(DOMPurify) {
  if (hookRegistered) return;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.getAttribute && node.getAttribute("style") != null) {
      const style = node.getAttribute("style") || "";
      const m = style.match(/text-align\s*:\s*([a-z]+)/i);
      if (m && ALIGN_RE.test(m[1].toLowerCase())) {
        node.setAttribute("style", `text-align: ${m[1].toLowerCase()}`);
      } else {
        node.removeAttribute("style");
      }
    }
    if (node.tagName === "IFRAME") {
      const src = node.getAttribute("src") || "";
      if (!YT_EMBED_RE.test(src)) {
        node.parentNode?.removeChild(node);
        return;
      }
      node.setAttribute("loading", "lazy");
      node.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-presentation",
      );
    }
  });
  hookRegistered = true;
}

export const NOTICIA_SANITIZE_CONFIG = {
  ALLOWED_TAGS: NOTICIA_ALLOWED_TAGS,
  ALLOWED_ATTR: NOTICIA_ALLOWED_ATTR,
  ALLOWED_URI_REGEXP,
  ADD_TAGS: ["iframe"],
};
