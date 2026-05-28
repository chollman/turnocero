import { describe, it, expect } from "vitest";
import { parseBgaUrl, BGA_URL_REGEX } from "./bga";

describe("BGA_URL_REGEX", () => {
  it("acepta URLs de boardgamearena.com con cualquier path", () => {
    expect(
      BGA_URL_REGEX.test("https://boardgamearena.com/gamepanel?game=catan"),
    ).toBe(true);
    expect(BGA_URL_REGEX.test("https://www.boardgamearena.com/lobby")).toBe(
      true,
    );
    expect(BGA_URL_REGEX.test("http://boardgamearena.com/x")).toBe(true);
  });

  it("rechaza otros dominios", () => {
    expect(BGA_URL_REGEX.test("https://boardgamearena.fr/lobby")).toBe(false);
    expect(BGA_URL_REGEX.test("https://otrositio.com/boardgamearena")).toBe(
      false,
    );
    expect(BGA_URL_REGEX.test("https://www.youtube.com/")).toBe(false);
  });

  it("rechaza URL sin path después del dominio", () => {
    // El regex pide `boardgamearena.com/...` con al menos 1 char tras el slash.
    expect(BGA_URL_REGEX.test("https://boardgamearena.com")).toBe(false);
  });
});

describe("parseBgaUrl", () => {
  it("devuelve URL canónica con schema", () => {
    expect(
      parseBgaUrl("https://boardgamearena.com/gamepanel?game=catan"),
    ).toBe("https://boardgamearena.com/gamepanel?game=catan");
  });

  it("agrega https:// cuando falta el schema", () => {
    expect(parseBgaUrl("boardgamearena.com/lobby")).toBe(
      "https://boardgamearena.com/lobby",
    );
    expect(parseBgaUrl("www.boardgamearena.com/x")).toBe(
      "https://www.boardgamearena.com/x",
    );
  });

  it("preserva http:// cuando el user lo pegó explícitamente", () => {
    expect(parseBgaUrl("http://boardgamearena.com/x")).toBe(
      "http://boardgamearena.com/x",
    );
  });

  it("trimea whitespace antes de evaluar", () => {
    expect(parseBgaUrl("  https://boardgamearena.com/lobby  ")).toBe(
      "https://boardgamearena.com/lobby",
    );
  });

  it("ignora casing del dominio (la regex es case-insensitive)", () => {
    expect(parseBgaUrl("HTTPS://BOARDGAMEARENA.COM/Catan")).toBe(
      "HTTPS://BOARDGAMEARENA.COM/Catan",
    );
  });

  it("devuelve null para dominios distintos", () => {
    expect(parseBgaUrl("https://boardgamearena.fr/lobby")).toBeNull();
    expect(parseBgaUrl("https://www.youtube.com")).toBeNull();
    expect(parseBgaUrl("https://otrositio.com")).toBeNull();
  });

  it("devuelve null para inputs vacíos / no-string", () => {
    expect(parseBgaUrl("")).toBeNull();
    expect(parseBgaUrl("   ")).toBeNull();
    expect(parseBgaUrl(null)).toBeNull();
    expect(parseBgaUrl(undefined)).toBeNull();
    expect(parseBgaUrl(123)).toBeNull();
  });

  it("devuelve null si el dominio no tiene path", () => {
    expect(parseBgaUrl("boardgamearena.com")).toBeNull();
  });
});
