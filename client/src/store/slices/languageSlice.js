import { createSlice, createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import axios from "axios";
import i18n from "../../i18n";
import { LANGS, DEFAULT_LANG, htmlLang, normalizeLang } from "../../i18n/config";
import { STORAGE_KEYS } from "../../utils/storageKeys";

export const getInitialLang = () => {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    return normalizeLang(localStorage.getItem(STORAGE_KEYS.LANGUAGE));
  } catch {
    return DEFAULT_LANG;
  }
};

const languageSlice = createSlice({
  name: "language",
  initialState: { value: getInitialLang() },
  reducers: {
    setLanguage: (state, action) => {
      if (LANGS.includes(action.payload)) state.value = action.payload;
    },
    toggleLanguage: (state) => {
      state.value = state.value === "es" ? "en" : "es";
    },
  },
});

export const { setLanguage, toggleLanguage } = languageSlice.actions;
export default languageSlice.reducer;

// Mirrors what the old LanguageContext did in a useEffect([lang]): sync
// i18next, <html lang>, the axios Accept-Language header, and persistence.
// Also runs once at import time so a fresh store (e.g. in tests, where the
// index.html pre-hydration script never runs) starts in sync.
export const languageListenerMiddleware = createListenerMiddleware();

const applyLanguage = (lang) => {
  if (i18n.language !== lang) i18n.changeLanguage(lang);
  document.documentElement.setAttribute("lang", htmlLang(lang));
  axios.defaults.headers.common["Accept-Language"] = lang;
  try {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  } catch {
    /* ignore quota errors */
  }
};

languageListenerMiddleware.startListening({
  matcher: isAnyOf(setLanguage, toggleLanguage),
  effect: (action, listenerApi) => {
    applyLanguage(listenerApi.getState().language.value);
  },
});

if (typeof document !== "undefined") {
  applyLanguage(getInitialLang());
}
