// Taxonomía editorial de Noticias. Dirige las tabs de la portada y el color del
// kicker por categoría. Las keys coinciden con el enum del server
// (server/models/Noticia.js → NOTICIA_CATEGORIES). Los colores usan los tokens
// de marca del proyecto (index.css), theme-aware.

export const NOTICIA_CATEGORIES = {
  general: { label: "General", color: "var(--text-secondary)" },
  comunidad: { label: "Comunidad", color: "var(--amber-light)" },
  resena: { label: "Reseña", color: "var(--purple)" },
  evento: { label: "Evento", color: "var(--orange)" },
  producto: { label: "Producto", color: "var(--green)" },
  envivo: { label: "En vivo", color: "var(--red)", live: true },
};

// Tabs de la portada: "Portada" (sin filtro) + categorías con su etiqueta de
// sección (plural). Distinta del label singular de la categoría (Reseña vs
// Reseñas) que se usa en kickers.
export const NOTICIA_SECTIONS = [
  { id: "all", label: "Portada" },
  { id: "comunidad", label: "Comunidad" },
  { id: "resena", label: "Reseñas" },
  { id: "evento", label: "Eventos" },
  { id: "producto", label: "Producto" },
  { id: "envivo", label: "En vivo" },
];

export function getCategory(key) {
  return NOTICIA_CATEGORIES[key] || NOTICIA_CATEGORIES.general;
}

export function categoryLabel(key) {
  return getCategory(key).label;
}

export function categoryColor(key) {
  return getCategory(key).color;
}

export function isLiveCategory(key) {
  return !!getCategory(key).live;
}
