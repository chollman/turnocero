// Formato sensible al idioma activo. Lee el idioma de i18next (`i18n.language`)
// y mapea al locale BCP-47 correspondiente para las APIs de Intl / toLocale*.
//
// Usar SIEMPRE estos helpers en vez de hardcodear "es-AR" en componentes nuevos
// (ver feedback_i18n_keys.md). Así el formato de números/fechas sigue el toggle
// de idioma. Para TEXTO (no formato) usar las keys de i18n (`t(...)`).
import i18n from "../i18n";

const LOCALE_BY_LANG = { es: "es-AR", en: "en-US" };

// Devuelve el locale BCP-47 del idioma activo ("es-AR" | "en-US").
export function getLocale() {
  const lang = (i18n.language || "es").slice(0, 2);
  return LOCALE_BY_LANG[lang] || LOCALE_BY_LANG.es;
}

// Intl.NumberFormat del locale activo. Ej: formatNumber(12.3, { minimumFractionDigits: 1 })
// → "12,3" (es) / "12.3" (en).
export function formatNumber(value, opts) {
  return new Intl.NumberFormat(getLocale(), opts).format(value);
}

// toLocaleDateString del locale activo. Acepta Date o algo parseable por Date.
export function formatDate(date, opts) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString(getLocale(), opts);
}

// toLocaleTimeString del locale activo.
export function formatTime(date, opts) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString(getLocale(), opts);
}
