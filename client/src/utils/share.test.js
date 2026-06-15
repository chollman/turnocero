import { describe, it, expect } from "vitest";
import {
  buildCompartidaShare,
  buildPartidaShare,
  buildNoticiaShare,
} from "./share";

const ORIGIN = "https://turnocero.app";

describe("buildNoticiaShare", () => {
  it("builds the deeplink and prefers the dek over the body", () => {
    const { url, caption, whatsappText } = buildNoticiaShare(
      {
        _id: "n1",
        title: "Gran nota",
        dek: "La bajada",
        body: "<p>cuerpo</p>",
      },
      ORIGIN,
    );
    expect(url).toBe(`${ORIGIN}/noticias/n1`);
    expect(caption).toBe("*Gran nota*\nLa bajada");
    expect(caption).not.toContain(url); // sin duplicado en Telegram
    expect(whatsappText).toContain(url);
  });

  it("strips HTML from the body when there is no dek", () => {
    const { caption } = buildNoticiaShare(
      { _id: "n2", title: "T", body: "<p>Hola <strong>mundo</strong></p>" },
      ORIGIN,
    );
    expect(caption).toBe("*T*\nHola mundo");
  });

  it("overrideUrl (short link) reemplaza el deeplink", () => {
    const short = "https://turnocero.app/s/abc12xZ";
    const { url, whatsappText } = buildNoticiaShare(
      { _id: "n3", title: "T" },
      ORIGIN,
      short,
    );
    expect(url).toBe(short);
    expect(whatsappText).toContain(short);
    expect(whatsappText).not.toContain("/noticias/n3");
  });
});

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

describe("buildPartidaShare", () => {
  const PLAY = {
    id: "12345",
    gameName: "Brass: Birmingham",
    date: "2026-06-01",
    location: "Casa de Cami",
  };

  it("builds the deeplink from origin + bggUsername + playId", () => {
    const { url } = buildPartidaShare(PLAY, "claudio", ORIGIN);
    expect(url).toBe(`${ORIGIN}/bg-watch/claudio/partidas/12345`);
  });

  it("caption lleva juego + fecha/lugar y NUNCA la url", () => {
    const { caption, url } = buildPartidaShare(PLAY, "claudio", ORIGIN);
    expect(caption).toContain("*Partida de Brass: Birmingham*");
    expect(caption).toContain("2026-06-01 · Casa de Cami");
    expect(caption).not.toContain(url);
  });

  it("whatsappText incluye la url exactamente una vez", () => {
    const { whatsappText, url } = buildPartidaShare(PLAY, "claudio", ORIGIN);
    expect(whatsappText.split(url).length - 1).toBe(1);
  });

  it("sin gameName ni meta: whatsappText es solo la url", () => {
    const { caption, whatsappText, url } = buildPartidaShare(
      { id: "9" },
      "claudio",
      ORIGIN,
    );
    expect(caption).toBe("");
    expect(whatsappText).toBe(`🎲 ${url}`);
  });

  it("overrideUrl (short link) reemplaza el deeplink", () => {
    const short = "https://turnocero.app/s/Zz1234x";
    const { url, whatsappText } = buildPartidaShare(
      PLAY,
      "claudio",
      ORIGIN,
      short,
    );
    expect(url).toBe(short);
    expect(whatsappText).toContain(short);
    expect(whatsappText).not.toContain("/bg-watch/claudio/partidas/12345");
  });

  it("encodea el bggUsername en el path", () => {
    const { url } = buildPartidaShare(PLAY, "user name", ORIGIN);
    expect(url).toBe(`${ORIGIN}/bg-watch/user%20name/partidas/12345`);
  });
});
