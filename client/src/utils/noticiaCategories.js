// Taxonomía editorial de Noticias. Dirige las tabs de la portada y el color del
// kicker por categoría. Las keys coinciden con el enum del server
// (server/models/Noticia.js → NOTICIA_CATEGORIES). Los colores usan los tokens
// de marca del proyecto (index.css), theme-aware.
//
// Los `label` salen por i18n (GETTERS — el idioma cambia en runtime con el
// toggle de /perfil). Los campos estructurales (`color`, `live`, `id`) quedan
// como JS plano en NOTICIA_CATEGORY_META.
import i18n from "../i18n";

// Solo la parte estructural (color/live) por categoría — no cambia con el idioma.
export const NOTICIA_CATEGORY_META = {
  general: { color: "var(--text-secondary)" },
  comunidad: { color: "var(--amber-light)" },
  resena: { color: "var(--purple)" },
  evento: { color: "var(--orange)" },
  producto: { color: "var(--green)" },
  envivo: { color: "var(--red)", live: true },
};

// Mezcla los labels de i18n con la metadata estructural. GETTER por el idioma
// runtime. Devuelve el mismo shape que la vieja const NOTICIA_CATEGORIES.
export function getNoticiaCategories() {
  const out = {};
  for (const [key, meta] of Object.entries(NOTICIA_CATEGORY_META)) {
    out[key] = { label: i18n.t(`enums:noticia.categories.${key}`), ...meta };
  }
  return out;
}

// Tabs de la portada: "Portada" (sin filtro) + categorías con su etiqueta de
// sección (plural). Distinta del label singular de la categoría (Reseña vs
// Reseñas) que se usa en kickers.
export function getNoticiaSections() {
  return [
    { id: "all", label: i18n.t("enums:noticia.sections.all") },
    { id: "comunidad", label: i18n.t("enums:noticia.sections.comunidad") },
    { id: "resena", label: i18n.t("enums:noticia.sections.resena") },
    { id: "evento", label: i18n.t("enums:noticia.sections.evento") },
    { id: "producto", label: i18n.t("enums:noticia.sections.producto") },
    { id: "envivo", label: i18n.t("enums:noticia.sections.envivo") },
  ];
}

export function getCategory(key) {
  const cats = getNoticiaCategories();
  return cats[key] || cats.general;
}

export function categoryLabel(key) {
  return getCategory(key).label;
}

export function categoryColor(key) {
  return (NOTICIA_CATEGORY_META[key] || NOTICIA_CATEGORY_META.general).color;
}

export function isLiveCategory(key) {
  return !!(NOTICIA_CATEGORY_META[key] || NOTICIA_CATEGORY_META.general).live;
}
