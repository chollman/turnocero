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
import esShared from "./resources/es/shared.json";
import enShared from "./resources/en/shared.json";
import esError from "./resources/es/error.json";
import enError from "./resources/en/error.json";
import esComunidades from "./resources/es/comunidades.json";
import enComunidades from "./resources/en/comunidades.json";
import esMathtrade from "./resources/es/mathtrade.json";
import enMathtrade from "./resources/en/mathtrade.json";
import esNoticias from "./resources/es/noticias.json";
import enNoticias from "./resources/en/noticias.json";
import esDashboard from "./resources/es/dashboard.json";
import enDashboard from "./resources/en/dashboard.json";
import esTorneos from "./resources/es/torneos.json";
import enTorneos from "./resources/en/torneos.json";
import esUsuarios from "./resources/es/usuarios.json";
import enUsuarios from "./resources/en/usuarios.json";
import esEventos from "./resources/es/eventos.json";
import enEventos from "./resources/en/eventos.json";
import esCompartidas from "./resources/es/compartidas.json";
import enCompartidas from "./resources/en/compartidas.json";

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
    shared: esShared,
    error: esError,
    comunidades: esComunidades,
    mathtrade: esMathtrade,
    noticias: esNoticias,
    dashboard: esDashboard,
    torneos: esTorneos,
    usuarios: esUsuarios,
    eventos: esEventos,
    compartidas: esCompartidas,
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
    shared: enShared,
    error: enError,
    comunidades: enComunidades,
    mathtrade: enMathtrade,
    noticias: enNoticias,
    dashboard: enDashboard,
    torneos: enTorneos,
    usuarios: enUsuarios,
    eventos: enEventos,
    compartidas: enCompartidas,
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
