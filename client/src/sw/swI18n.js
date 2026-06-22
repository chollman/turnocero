// i18next standalone (sin react-i18next) para el bundle del service worker.
// El SW NO debe importar React: usamos `i18next.createInstance()` con los mismos
// recursos del namespace `notifs` que la app, así el copy del push nunca diverge
// del de la bandeja in-app (única fuente de verdad para las 34 notifs).
//
// `notifT(lang)` devuelve un `t` fijado al idioma + namespace `notifs`, listo
// para pasarle a `getNotifMeta(data, t)` desde pushNotification.js.
import i18next from "i18next";
import esNotifs from "../i18n/resources/es/notifs.json";
import enNotifs from "../i18n/resources/en/notifs.json";

const instance = i18next.createInstance();

instance.init({
  resources: {
    es: { notifs: esNotifs },
    en: { notifs: enNotifs },
  },
  lng: "es",
  fallbackLng: "es",
  ns: ["notifs"],
  defaultNS: "notifs",
  nsSeparator: ":",
  keySeparator: ".",
  // Una key `en` faltante cae al español en vez de mostrar la key cruda.
  returnEmptyString: false,
  // Init síncrono (recursos inline) — sin promesas en el SW.
  initImmediate: false,
  interpolation: { escapeValue: false },
});

// `t` fijado al idioma del payload (default es) + namespace `notifs`.
export function notifT(lang) {
  return instance.getFixedT(lang === "en" ? "en" : "es", "notifs");
}

export default instance;
