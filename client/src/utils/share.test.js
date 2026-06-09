import { describe, it, expect } from "vitest";
import { buildCompartidaShare } from "./share";

const ORIGIN = "https://turnocero.app";

describe("buildCompartidaShare", () => {
  it("builds the deeplink from origin + id", () => {
    const { url } = buildCompartidaShare({ _id: "abc123" }, ORIGIN);
    expect(url).toBe("https://turnocero.app/compartidas/abc123");
  });

  it("caption NUNCA contiene la url (evita el duplicado de Telegram)", () => {
    const { url, caption } = buildCompartidaShare(
      { _id: "abc123", title: "Épica", body: "Ganamos en el último turno" },
      ORIGIN,
    );
    expect(caption).not.toContain(url);
    expect(caption).not.toContain("/compartidas/");
    expect(caption).toContain("*Épica*");
    expect(caption).toContain("Ganamos en el último turno");
  });

  it("whatsappText incluye la url exactamente una vez", () => {
    const { url, whatsappText } = buildCompartidaShare(
      { _id: "abc123", title: "T", body: "B" },
      ORIGIN,
    );
    const occurrences = whatsappText.split(url).length - 1;
    expect(occurrences).toBe(1);
    expect(whatsappText).toMatch(/🎲/);
  });

  it("sin título ni body: caption vacío y whatsappText es solo la url", () => {
    const { url, caption, whatsappText } = buildCompartidaShare(
      { _id: "x" },
      ORIGIN,
    );
    expect(caption).toBe("");
    expect(whatsappText).toBe(`🎲 ${url}`);
  });

  it("trunca bodies largos a 180 chars con elipsis", () => {
    const long = "a".repeat(500);
    const { caption } = buildCompartidaShare({ _id: "x", body: long }, ORIGIN);
    expect(caption).toBe(`${"a".repeat(180)}…`);
  });

  it("origin por defecto vacío → url relativa", () => {
    const { url } = buildCompartidaShare({ _id: "rel" });
    expect(url).toBe("/compartidas/rel");
  });

  it("overrideUrl (short link) reemplaza el deeplink en url y whatsappText", () => {
    const short = "https://turnocero.app/s/Ab3xK9";
    const { url, whatsappText, caption } = buildCompartidaShare(
      { _id: "abc123", title: "T", body: "B" },
      ORIGIN,
      short,
    );
    expect(url).toBe(short);
    expect(whatsappText).toContain(short);
    expect(whatsappText).not.toContain("/compartidas/abc123");
    // El caption sigue sin la url (cualquiera).
    expect(caption).not.toContain(short);
  });
});
