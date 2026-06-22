// Inicialización de i18next para el server. Init síncrono (recursos inline,
// initImmediate:false) al require — deja el singleton listo para:
//   - el middleware `handler` que adjunta req.t/req.language por request
//     (idioma vía header Accept-Language), montado en app.js antes de las rutas.
//   - `getFixedT(lang, ns)` para contenido fuera de un request (ej. emails
//     localizados por el idioma guardado del destinatario, User.language).
//
// Al agregar un namespace: crear resources/{es,en}/<ns>.json, importarlo acá y
// sumarlo a NAMESPACES en config.js.
const i18next = require("i18next");
const middleware = require("i18next-http-middleware");
const {
  LANGS,
  DEFAULT_LANG,
  NAMESPACES,
  DEFAULT_NS,
} = require("./config");

const resources = {
  es: {
    errors: require("./resources/es/errors.json"),
    validation: require("./resources/es/validation.json"),
    email: require("./resources/es/email.json"),
    success: require("./resources/es/success.json"),
  },
  en: {
    errors: require("./resources/en/errors.json"),
    validation: require("./resources/en/validation.json"),
    email: require("./resources/en/email.json"),
    success: require("./resources/en/success.json"),
  },
};

if (!i18next.isInitialized) {
  i18next.use(middleware.LanguageDetector).init({
    resources,
    fallbackLng: DEFAULT_LANG,
    supportedLngs: LANGS,
    preload: LANGS,
    // "en-US" → "en": matchea por prefijo de idioma para requests directos del
    // navegador (nuestro cliente igual manda exactamente "es"/"en").
    load: "languageOnly",
    nonExplicitSupportedLngs: true,
    ns: NAMESPACES,
    defaultNS: DEFAULT_NS,
    nsSeparator: ":",
    keySeparator: ".",
    returnEmptyString: false,
    interpolation: { escapeValue: false },
    initImmediate: false,
    detection: {
      order: ["header"],
      lookupHeader: "accept-language",
    },
  });
}

// Express middleware: parsea Accept-Language y adjunta req.t + req.language.
const handler = middleware.handle(i18next);

// Helper para traducir fuera de un request (emails, jobs/cron): fija el idioma
// del destinatario en vez del request.
function getFixedT(lang, ns) {
  return i18next.getFixedT(lang || DEFAULT_LANG, ns);
}

module.exports = { i18next, resources, handler, getFixedT };
