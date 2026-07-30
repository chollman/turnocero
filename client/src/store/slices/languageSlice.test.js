import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import axios from "axios";
import languageReducer, {
  getInitialLang,
  setLanguage,
  toggleLanguage,
  languageListenerMiddleware,
} from "./languageSlice";
import { STORAGE_KEYS } from "../../utils/storageKeys";
import i18n from "../../i18n";

function buildStore() {
  return configureStore({
    reducer: { language: languageReducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(languageListenerMiddleware.middleware),
  });
}

beforeEach(() => {
  localStorage.clear();
  delete axios.defaults.headers.common["Accept-Language"];
});

afterEach(() => {
  i18n.changeLanguage("es");
});

describe("getInitialLang", () => {
  it("defaults to es when localStorage has no preference", () => {
    expect(getInitialLang()).toBe("es");
  });

  it("reads the saved language from localStorage", () => {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, "en");
    expect(getInitialLang()).toBe("en");
  });

  it("falls back to es on an invalid stored value", () => {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, "zz");
    expect(getInitialLang()).toBe("es");
  });
});

describe("languageSlice reducer", () => {
  it("setLanguage updates to a valid language", () => {
    const state = languageReducer({ value: "es" }, setLanguage("en"));
    expect(state.value).toBe("en");
  });

  it("setLanguage rejects invalid values", () => {
    const state = languageReducer({ value: "es" }, setLanguage("zz"));
    expect(state.value).toBe("es");
  });

  it("toggleLanguage flips between es and en", () => {
    let state = languageReducer({ value: "es" }, toggleLanguage());
    expect(state.value).toBe("en");
    state = languageReducer(state, toggleLanguage());
    expect(state.value).toBe("es");
  });
});

describe("language listener middleware", () => {
  it("syncs i18next, <html lang>, the axios header, and localStorage on dispatch", () => {
    const store = buildStore();
    store.dispatch(setLanguage("en"));
    expect(i18n.language).toBe("en");
    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(axios.defaults.headers.common["Accept-Language"]).toBe("en");
    expect(localStorage.getItem(STORAGE_KEYS.LANGUAGE)).toBe("en");
  });

  it("uses es-AR for <html lang> when switching back to es", () => {
    const store = buildStore();
    store.dispatch(setLanguage("en"));
    store.dispatch(setLanguage("es"));
    expect(document.documentElement.getAttribute("lang")).toBe("es-AR");
  });
});
