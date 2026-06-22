// Inicialización (side-effect) de i18next para el cliente. Importar este módulo
// una vez (lo hace LanguageContext, y main.jsx vía el árbol de App) deja el
// singleton global listo para `useTranslation()`/`t()` en toda la app.
//
// Recursos bundleados (no HTTP backend): cada namespace es un JSON importado.
// Al agregar un namespace nuevo: crear resources/{es,en}/<ns>.json, importarlo
// acá y sumarlo a NAMESPACES en config.js.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  LANGS,
  DEFAULT_LANG,
  DEFAULT_NS,
  NAMESPACES,
} from "./config";
import { STORAGE_KEYS } from "../utils/storageKeys";
import esCommon from "./resources/es/common.json";
import enCommon from "./resources/en/common.json";
import esAuth from "./resources/es/auth.json";
import enAuth from "./resources/en/auth.json";
import esNotifs from "./resources/es/notifs.json";
import enNotifs from "./resources/en/notifs.json";
import esTime from "./resources/es/time.json";
import enTime from "./resources/en/time.json";
import esDates from "./resources/es/dates.json";
import enDates from "./resources/en/dates.json";
import esEnums from "./resources/es/enums.json";
import enEnums from "./resources/en/enums.json";
import esQuotes from "./resources/es/quotes.json";
import enQuotes from "./resources/en/quotes.json";
import esLayout from "./resources/es/layout.json";
import enLayout from "./resources/en/layout.json";
import esToasts from "./resources/es/toasts.json";
import enToasts from "./resources/en/toasts.json";

export const resources = {
  es: {
    common: esCommon,
    auth: esAuth,
    notifs: esNotifs,
    time: esTime,
    dates: esDates,
    enums: esEnums,
    quotes: esQuotes,
    layout: esLayout,
    toasts: esToasts,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    notifs: enNotifs,
    time: enTime,
    dates: enDates,
    enums: enEnums,
    quotes: enQuotes,
    layout: enLayout,
    toasts: enToasts,
  },
};

function getInitialLang() {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
    return LANGS.includes(stored) ? stored : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: getInitialLang(),
    fallbackLng: DEFAULT_LANG,
    supportedLngs: LANGS,
    ns: NAMESPACES,
    defaultNS: DEFAULT_NS,
    nsSeparator: ":",
    keySeparator: ".",
    // Una key `en` faltante cae al español en vez de mostrar la key cruda.
    returnEmptyString: false,
    // React ya escapa; i18next no debe re-escapar las interpolaciones.
    interpolation: { escapeValue: false },
    // Init síncrono (recursos inline) — evita parpadeo de keys en el primer
    // render y hace los tests deterministas sin esperar promesas.
    initImmediate: false,
    react: { useSuspense: false },
  });
}

export default i18n;
