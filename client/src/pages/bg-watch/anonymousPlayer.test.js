import { describe, it, expect } from "vitest";
import { ANON_PREFIX, makeAnonName, isAnonName } from "./anonymousPlayer";

describe("anonymousPlayer", () => {
  it("makeAnonName numera con el prefijo reservado", () => {
    expect(makeAnonName(1)).toBe("Jugador anónimo 1");
    expect(makeAnonName(3)).toBe(`${ANON_PREFIX} 3`);
  });

  it("isAnonName reconoce el prefijo con y sin número", () => {
    expect(isAnonName("Jugador anónimo 1")).toBe(true);
    expect(isAnonName("Jugador anónimo 12")).toBe(true);
    expect(isAnonName("Jugador anónimo")).toBe(true);
  });

  it("isAnonName es case- y acento-insensible", () => {
    expect(isAnonName("jugador anonimo 2")).toBe(true);
    expect(isAnonName("JUGADOR ANÓNIMO 5")).toBe(true);
    expect(isAnonName("  Jugador anónimo 1  ")).toBe(true);
  });

  it("isAnonName no marca nombres reales (sin falsos positivos)", () => {
    expect(isAnonName("Ana")).toBe(false);
    expect(isAnonName("Jugador estrella")).toBe(false);
    expect(isAnonName("El jugador anónimo del barrio")).toBe(false);
    expect(isAnonName("")).toBe(false);
    expect(isAnonName(null)).toBe(false);
    expect(isAnonName(undefined)).toBe(false);
  });
});
