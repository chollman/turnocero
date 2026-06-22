import { createContext, useContext, useState, useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import axios from "axios";
import i18n from "../i18n";
import { LANGS, DEFAULT_LANG, htmlLang, normalizeLang } from "../i18n/config";
import { STORAGE_KEYS } from "../utils/storageKeys";

// Espeja el patrón de ThemeContext: estado en React + persistencia en
// localStorage + atributo en <html>. Acá además respaldamos i18next
// (changeLanguage) y el header Accept-Language de axios para que el server
// localice errores/emails. Es el wrapper "de cara a la app" sobre i18next.
const getInitialLang = () => {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    return normalizeLang(localStorage.getItem(STORAGE_KEYS.LANGUAGE));
  } catch {
    return DEFAULT_LANG;
  }
};

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(getInitialLang);

  useEffect(() => {
    if (i18n.language !== lang) i18n.changeLanguage(lang);
    document.documentElement.setAttribute("lang", htmlLang(lang));
    axios.defaults.headers.common["Accept-Language"] = lang;
    try {
      localStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
    } catch {
      /* ignore quota errors */
    }
  }, [lang]);

  const setLang = (next) => {
    if (LANGS.includes(next)) setLangState(next);
  };

  const toggleLang = () => {
    setLangState((prev) => (prev === "es" ? "en" : "es"));
  };

  return (
    <I18nextProvider i18n={i18n}>
      <LanguageContext.Provider value={{ lang, setLang, toggleLang }}>
        {children}
      </LanguageContext.Provider>
    </I18nextProvider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
