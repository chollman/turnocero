import { describe, it, expect, vi, afterEach } from "vitest";
import { getCompartidaQuotes, randomCompartidaQuote } from "./compartidaQuotes";
import i18n from "../i18n";

describe("compartidaQuotes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    i18n.changeLanguage("es");
  });

  it("expone el listado completo de frases", () => {
    expect(getCompartidaQuotes()).toHaveLength(20);
    expect(
      getCompartidaQuotes().every((q) => typeof q === "string" && q.length),
    ).toBe(true);
  });

  it("randomCompartidaQuote devuelve una frase del listado", () => {
    for (let i = 0; i < 50; i++) {
      expect(getCompartidaQuotes()).toContain(randomCompartidaQuote());
    }
  });

  it("elige según Math.random (primer y último índice)", () => {
    const quotes = getCompartidaQuotes();
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(randomCompartidaQuote()).toBe(quotes[0]);

    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    expect(randomCompartidaQuote()).toBe(quotes[quotes.length - 1]);
  });

  it("traduce las frases al inglés", () => {
    i18n.changeLanguage("en");
    const quotes = getCompartidaQuotes();
    expect(quotes).toHaveLength(20);
    // Una frase representativa en inglés.
    expect(quotes[16]).toBe(
      "Life is short, take the extra turn and may God help you.",
    );
  });
});
