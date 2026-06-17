import { describe, it, expect } from "vitest";
import {
  computePlayerPositions,
  sortPlayersByScoreDesc,
  assignWinsByScore,
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

  it("sin puntajes pero con un 'Ganó' marcado: ganador 1°, resto 2°", () => {
    expect(
      computePlayerPositions([
        { score: "", win: false },
        { score: "", win: true },
        { score: "", win: false },
      ]),
    ).toEqual([2, 1, 2]);
  });

  it("sin puntajes con varios ganadores: todos 1°, el resto 2°", () => {
    expect(
      computePlayerPositions([
        { score: "", win: true },
        { score: "", win: true },
        { score: "", win: false },
      ]),
    ).toEqual([1, 1, 2]);
  });

  it("sin puntajes y sin ganador marcado usa el orden del array", () => {
    expect(
      computePlayerPositions([
        { score: "", win: false },
        { score: "", win: false },
      ]),
    ).toEqual([1, 2]);
  });

  it("ignora 'null'/vacío como score y aplica el ranking por 'Ganó'", () => {
    expect(
      computePlayerPositions([
        { score: "null", win: false },
        { score: "", win: true },
      ]),
    ).toEqual([2, 1]);
  });

  it("con algún score numérico, el 'Ganó' NO altera el ranking (manda el puntaje)", () => {
    expect(
      computePlayerPositions([
        { score: "5", win: true },
        { score: "10", win: false },
      ]),
    ).toEqual([2, 1]);
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

describe("assignWinsByScore", () => {
  const PW = (score, win = false) => ({ name: "x", score, win });

  it("sin scores numéricos no toca win (deja el toggle manual)", () => {
    const players = [PW("", true), PW("", false)];
    const out = assignWinsByScore(players);
    expect(out.map((p) => p.win)).toEqual([true, false]);
  });

  it("marca win al puntaje más alto y desmarca el resto", () => {
    const out = assignWinsByScore([PW("5", true), PW("10"), PW("7", true)]);
    expect(out.map((p) => p.win)).toEqual([false, true, false]);
  });

  it("los empates en el máximo comparten la victoria", () => {
    const out = assignWinsByScore([PW("8"), PW("8"), PW("3")]);
    expect(out.map((p) => p.win)).toEqual([true, true, false]);
  });

  it("soporta decimales y negativos", () => {
    const out = assignWinsByScore([PW("-1"), PW("0.5"), PW("0")]);
    expect(out.map((p) => p.win)).toEqual([false, true, false]);
  });

  it("ignora scores no numéricos ('null'/vacío) al buscar el máximo", () => {
    const out = assignWinsByScore([PW("null"), PW("4"), PW("")]);
    expect(out.map((p) => p.win)).toEqual([false, true, false]);
  });

  it("no muta el input", () => {
    const players = [PW("3"), PW("9")];
    const snap = JSON.stringify(players);
    assignWinsByScore(players);
    expect(JSON.stringify(players)).toBe(snap);
  });
});
