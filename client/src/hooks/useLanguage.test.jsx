import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import axios from "axios";
import languageReducer, {
  languageListenerMiddleware,
} from "../store/slices/languageSlice";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { useLanguage } from "./useLanguage";
import i18n from "../i18n";

function buildStore(initialLang = "es") {
  return configureStore({
    reducer: { language: languageReducer },
    preloadedState: { language: { value: initialLang } },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(languageListenerMiddleware.middleware),
  });
}

function Probe() {
  const { lang, setLang, toggleLang } = useLanguage();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="cancel">{i18n.t("common:actions.cancel")}</span>
      <button onClick={() => setLang("en")}>to-en</button>
      <button onClick={() => setLang("zz")}>to-invalid</button>
      <button onClick={toggleLang}>toggle</button>
    </div>
  );
}

function renderProbe(initialLang) {
  return render(
    <Provider store={buildStore(initialLang)}>
      <Probe />
    </Provider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  delete axios.defaults.headers.common["Accept-Language"];
});

afterEach(() => {
  act(() => {
    i18n.changeLanguage("es");
  });
});

describe("useLanguage", () => {
  it("reads the current language from the store", () => {
    renderProbe("es");
    expect(screen.getByTestId("lang")).toHaveTextContent("es");
    expect(screen.getByTestId("cancel")).toHaveTextContent("Cancelar");
  });

  it("setLang('en') dispatches, syncs i18next/html/header, and persists", () => {
    renderProbe("es");
    act(() => screen.getByText("to-en").click());
    expect(screen.getByTestId("lang")).toHaveTextContent("en");
    expect(screen.getByTestId("cancel")).toHaveTextContent("Cancel");
    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(axios.defaults.headers.common["Accept-Language"]).toBe("en");
    expect(localStorage.getItem(STORAGE_KEYS.LANGUAGE)).toBe("en");
  });

  it("setLang rejects invalid values", () => {
    renderProbe("es");
    act(() => screen.getByText("to-invalid").click());
    expect(screen.getByTestId("lang")).toHaveTextContent("es");
  });

  it("toggleLang alterna es <-> en", () => {
    renderProbe("es");
    act(() => screen.getByText("toggle").click());
    expect(screen.getByTestId("lang")).toHaveTextContent("en");
    act(() => screen.getByText("toggle").click());
    expect(screen.getByTestId("lang")).toHaveTextContent("es");
  });
});
