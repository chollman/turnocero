import { describe, it, expect } from "vitest";
import {
  computePlayerPositions,
  sortPlayersByScoreDesc,
} from "./playerPositions";

const P = (score) => ({ name: "x", score });

describe("computePlayerPositions", () => {
  it("sin scores numéricos usa el orden del array", () => {
    expect(computePlayerPositions([P(""), P(""), P("")])).toEqual([1, 2, 3]);
  });

  it("trata 'null'/'undefined'/vacío como sin score", () => {
    expect(computePlayerPositions([P("null"), P("undefined"), P("")])).toEqual([
      1, 2, 3,
    ]);
  });

  it("rankea por score desc (mayor = 1°)", () => {
    expect(computePlayerPositions([P("5"), P("10"), P("7")])).toEqual([
      3, 1, 2,
    ]);
  });

  it("los empates comparten posición (1,2,2,4)", () => {
    expect(computePlayerPositions([P("10"), P("8"), P("8"), P("5")])).toEqual([
      1, 2, 2, 4,
    ]);
  });

  it("soporta decimales y negativos", () => {
    expect(computePlayerPositions([P("-3"), P("10.5"), P("0")])).toEqual([
      3, 1, 2,
    ]);
  });

  it("los sin score numérico quedan al final, en orden original", () => {
    // idx0 sin score, idx1=10, idx2 sin score, idx3=5
    expect(
      computePlayerPositions([P(""), P("10"), P(""), P("5")]),
    ).toEqual([3, 1, 4, 2]);
  });

  it("no muta el input", () => {
    const players = [P("3"), P("9")];
    const snapshot = JSON.stringify(players);
    computePlayerPositions(players);
    expect(JSON.stringify(players)).toBe(snapshot);
  });

  it("maneja lista vacía", () => {
    expect(computePlayerPositions([])).toEqual([]);
  });
});

describe("sortPlayersByScoreDesc", () => {
  it("ordena por score desc", () => {
    const out = sortPlayersByScoreDesc([P("5"), P("10"), P("7")]);
    expect(out.map((p) => p.score)).toEqual(["10", "7", "5"]);
  });

  it("manda los sin score al final, en orden original", () => {
    const a = { name: "a", score: "" };
    const b = { name: "b", score: "8" };
    const c = { name: "c", score: "" };
    const out = sortPlayersByScoreDesc([a, b, c]);
    expect(out.map((p) => p.name)).toEqual(["b", "a", "c"]);
  });

  it("es estable con scores empatados", () => {
    const a = { name: "a", score: "8" };
    const b = { name: "b", score: "8" };
    const out = sortPlayersByScoreDesc([a, b]);
    expect(out.map((p) => p.name)).toEqual(["a", "b"]);
  });

  it("no muta el input", () => {
    const players = [P("3"), P("9")];
    const snapshot = JSON.stringify(players);
    sortPlayersByScoreDesc(players);
    expect(JSON.stringify(players)).toBe(snapshot);
  });
});
