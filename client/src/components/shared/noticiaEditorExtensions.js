// Extensiones extra del editor para el cuerpo de Noticias (no usadas por las
// reseñas de Compartidas). Implementadas sobre @tiptap/core para no sumar
// dependencias nuevas.

import { Extension, Node, mergeAttributes } from "@tiptap/core";

// Extrae el videoId de una URL de YouTube en sus formas comunes (watch, youtu.be,
// embed, shorts) o acepta directamente un id pelado.
export function extractYoutubeId(input) {
  if (!input || typeof input !== "string") return null;
  const url = input.trim();
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{6,20})/,
    /youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,20})/,
    /[?&]v=([A-Za-z0-9_-]{6,20})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  if (/^[A-Za-z0-9_-]{6,20}$/.test(url)) return url;
  return null;
}

// Nodo atómico que renderiza un <iframe> de YouTube (dominio sin cookies). El
// sanitizador (cliente + server) solo acepta src youtube-nocookie.com/embed/<id>.
export const YoutubeEmbed = Node.create({
  name: "youtube",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return { src: { default: null } };
  },

  parseHTML() {
    return [{ tag: 'iframe[src*="youtube-nocookie.com/embed/"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "iframe",
      mergeAttributes(HTMLAttributes, {
        frameborder: "0",
        allowfullscreen: "true",
        allow: "accelerometer; encrypted-media; gyroscope; picture-in-picture",
        sandbox: "allow-scripts allow-same-origin allow-presentation",
        loading: "lazy",
      }),
    ];
  },

  addCommands() {
    return {
      setYoutubeVideo:
        (id) =>
        ({ commands }) => {
          if (!id) return false;
          return commands.insertContent({
            type: this.name,
            attrs: { src: `https://www.youtube-nocookie.com/embed/${id}` },
          });
        },
    };
  },
});

// Alineación de texto como atributo global (espejo mínimo de
// @tiptap/extension-text-align). Renderiza `style="text-align: …"`, que el
// sanitizador reduce a esa única declaración.
export const TextAlign = Extension.create({
  name: "textAlign",

  addOptions() {
    return {
      types: ["paragraph", "heading"],
      alignments: ["left", "center", "right", "justify"],
      defaultAlignment: null,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: this.options.defaultAlignment,
            parseHTML: (el) => el.style.textAlign || null,
            renderHTML: (attrs) =>
              attrs.textAlign
                ? { style: `text-align: ${attrs.textAlign}` }
                : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextAlign:
        (alignment) =>
        ({ commands }) => {
          if (!this.options.alignments.includes(alignment)) return false;
          return this.options.types
            .map((type) =>
              commands.updateAttributes(type, { textAlign: alignment }),
            )
            .every((r) => r);
        },
    };
  },
});
