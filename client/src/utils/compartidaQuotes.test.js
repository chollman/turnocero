import { describe, it, expect, vi, afterEach } from "vitest";
import { COMPARTIDA_QUOTES, randomCompartidaQuote } from "./compartidaQuotes";

describe("compartidaQuotes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("expone el listado completo de frases", () => {
    expect(COMPARTIDA_QUOTES).toHaveLength(20);
    expect(
      COMPARTIDA_QUOTES.every((q) => typeof q === "string" && q.length),
    ).toBe(true);
  });

  it("randomCompartidaQuote devuelve una frase del listado", () => {
    for (let i = 0; i < 50; i++) {
      expect(COMPARTIDA_QUOTES).toContain(randomCompartidaQuote());
    }
  });

  it("elige según Math.random (primer y último índice)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(randomCompartidaQuote()).toBe(COMPARTIDA_QUOTES[0]);

    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    expect(randomCompartidaQuote()).toBe(
      COMPARTIDA_QUOTES[COMPARTIDA_QUOTES.length - 1],
    );
  });
});
