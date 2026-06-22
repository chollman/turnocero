// Configuración central de i18n del server. Espeja client/src/i18n/config.js
// (mismos idiomas, mismo formato de keys `ns:section.key`). Mantener en sync.
const LANGS = ["es", "en"];
const DEFAULT_LANG = "es";

// Un archivo JSON por namespace bajo resources/<lang>/. Se expanden a medida
// que se migran rutas/emails (PR4+). `errors` es el default namespace.
const NAMESPACES = ["errors", "validation", "email", "success"];
const DEFAULT_NS = "errors";

function normalizeLang(value) {
  return LANGS.includes(value) ? value : DEFAULT_LANG;
}

module.exports = { LANGS, DEFAULT_LANG, NAMESPACES, DEFAULT_NS, normalizeLang };
