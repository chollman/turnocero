// Configuración central de i18n del cliente. Mantener en sync con el server
// (server/i18n/config.js) y con la convención en feedback_i18n_keys.md.
//
// Idiomas soportados. `es` (español rioplatense) es el default histórico; `en`
// (inglés) es opcional vía el toggle de /perfil. NO autodetectamos el navegador.
export const LANGS = ["es", "en"];
export const DEFAULT_LANG = "es";

// Namespaces = un archivo JSON por dominio bajo resources/<lang>/. Se van
// sumando a medida que se migra cada sección (mesas, torneos, …). `common` es
// el default namespace (keys sin prefijo `ns:` resuelven acá).
export const NAMESPACES = [
  "common",
  "auth",
  "notifs",
  "time",
  "dates",
  "enums",
  "quotes",
  "layout",
  "toasts",
  "shared",
  "error",
];
export const DEFAULT_NS = "common";

// Mapea el código interno (`es`/`en`) al valor del atributo <html lang> para
// a11y/SEO. Usamos `es-AR` para reflejar el español argentino.
export function htmlLang(lang) {
  return lang === "es" ? "es-AR" : "en";
}

// Normaliza cualquier valor (localStorage, header, etc.) a un idioma válido.
export function normalizeLang(value) {
  return LANGS.includes(value) ? value : DEFAULT_LANG;
}
