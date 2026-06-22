import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import axios from "axios";
import { LanguageProvider, useLanguage } from "./LanguageContext";
import { STORAGE_KEYS } from "../utils/storageKeys";
import i18n from "../i18n";

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

describe("LanguageContext", () => {
  beforeEach(() => {
    localStorage.clear();
    delete axios.defaults.headers.common["Accept-Language"];
  });

  afterEach(() => {
    act(() => {
      i18n.changeLanguage("es");
    });
  });

  it("arranca en español por defecto y traduce con el recurso es", () => {
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("lang")).toHaveTextContent("es");
    expect(screen.getByTestId("cancel")).toHaveTextContent("Cancelar");
    expect(document.documentElement.getAttribute("lang")).toBe("es-AR");
    expect(axios.defaults.headers.common["Accept-Language"]).toBe("es");
  });

  it("setLang('en') cambia idioma, html lang, header y persiste", () => {
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    act(() => {
      screen.getByText("to-en").click();
    });
    expect(screen.getByTestId("lang")).toHaveTextContent("en");
    expect(screen.getByTestId("cancel")).toHaveTextContent("Cancel");
    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(axios.defaults.headers.common["Accept-Language"]).toBe("en");
    expect(localStorage.getItem(STORAGE_KEYS.LANGUAGE)).toBe("en");
  });

  it("ignora idiomas inválidos", () => {
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    act(() => {
      screen.getByText("to-invalid").click();
    });
    expect(screen.getByTestId("lang")).toHaveTextContent("es");
  });

  it("toggleLang alterna es ↔ en", () => {
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    act(() => {
      screen.getByText("toggle").click();
    });
    expect(screen.getByTestId("lang")).toHaveTextContent("en");
    act(() => {
      screen.getByText("toggle").click();
    });
    expect(screen.getByTestId("lang")).toHaveTextContent("es");
  });

  it("lee el idioma persistido al montar", () => {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, "en");
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("lang")).toHaveTextContent("en");
  });
});
