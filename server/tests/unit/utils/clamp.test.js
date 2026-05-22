const { clamp } = require("../../../utils/clamp");

describe("clamp", () => {
  it("devuelve n si está adentro del rango", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("clampa al límite inferior si n < lo", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(0, 5, 10)).toBe(5);
  });

  it("clampa al límite superior si n > hi", () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(100, 2, 12)).toBe(12);
  });

  it("devuelve lo cuando n no es número finito", () => {
    expect(clamp(NaN, 2, 12)).toBe(2);
    expect(clamp(Infinity, 2, 12)).toBe(2);
    expect(clamp(-Infinity, 2, 12)).toBe(2);
    expect(clamp(undefined, 5, 10)).toBe(5);
    expect(clamp(null, 5, 10)).toBe(5);
  });

  it("soporta floats", () => {
    expect(clamp(1.5, 0, 2)).toBe(1.5);
    expect(clamp(-0.1, 0, 2)).toBe(0);
    expect(clamp(2.5, 0, 2)).toBe(2);
  });
});
