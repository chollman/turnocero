import { describe, it, expect } from "vitest";
import {
  composeComments,
  parseComments,
  SIGNATURE,
  MAX_COMMENT_LENGTH,
} from "./playComments";

describe("composeComments", () => {
  it("sólo notas → tal cual (sin firma si sign=false)", () => {
    expect(composeComments({ notes: "Gran partida" })).toBe("Gran partida");
  });

  it("agrega firma al final cuando sign=true", () => {
    expect(composeComments({ notes: "Hola", sign: true })).toBe(
      `Hola\n\n${SIGNATURE}`,
    );
  });

  it("compone expansiones como bloque de links [thing]", () => {
    const out = composeComments({
      notes: "Notas",
      expansions: [
        { id: 300580, name: "Wingspan: Oceania" },
        { id: 266524, name: "European Expansion" },
      ],
    });
    expect(out).toContain("Played with expansions:");
    expect(out).toContain("- [thing=300580]Wingspan: Oceania[/thing]");
    expect(out).toContain("- [thing=266524]European Expansion[/thing]");
  });

  it("compone variante", () => {
    expect(composeComments({ variant: "Escenario 3" })).toBe(
      "Variante/Tablero: Escenario 3",
    );
  });

  it("orden: notas, expansiones, variante, firma", () => {
    const out = composeComments({
      notes: "N",
      expansions: [{ id: 1, name: "Exp" }],
      variant: "V",
      sign: true,
    });
    expect(out).toBe(
      `N\n\nPlayed with expansions:\n- [thing=1]Exp[/thing]\n\nVariante/Tablero: V\n\n${SIGNATURE}`,
    );
  });

  it("ignora expansiones inválidas (sin id o name)", () => {
    expect(
      composeComments({ expansions: [{ id: 0, name: "x" }, { name: "y" }] }),
    ).toBe("");
  });

  // ── Budget: la firma/expansiones nunca se pierden por el tope (#1) ──────
  it("con notas largas recorta las notas pero CONSERVA la firma", () => {
    const notes = "n".repeat(MAX_COMMENT_LENGTH); // notas al máximo
    const out = composeComments({ notes, sign: true });
    expect(out.length).toBeLessThanOrEqual(MAX_COMMENT_LENGTH);
    expect(out.endsWith(SIGNATURE)).toBe(true);
  });

  it("con notas largas + expansiones + variante + firma, conserva todos los bloques", () => {
    const notes = "n".repeat(MAX_COMMENT_LENGTH);
    const out = composeComments({
      notes,
      expansions: [{ id: 300580, name: "Wingspan: Oceania" }],
      variant: "Mapa Norte",
      sign: true,
    });
    expect(out.length).toBeLessThanOrEqual(MAX_COMMENT_LENGTH);
    expect(out).toContain("Played with expansions:");
    expect(out).toContain("[thing=300580]Wingspan: Oceania[/thing]");
    expect(out).toContain("Variante/Tablero: Mapa Norte");
    expect(out.endsWith(SIGNATURE)).toBe(true);
    // El recorte cae sobre las notas, no sobre los bloques.
    const parsed = parseComments(out);
    expect(parsed.signed).toBe(true);
    expect(parsed.variant).toBe("Mapa Norte");
    expect(parsed.expansions).toEqual([{ id: 300580, name: "Wingspan: Oceania" }]);
  });

  it("notas dentro del tope no se tocan", () => {
    const out = composeComments({ notes: "Partida corta", sign: true });
    expect(out).toBe(`Partida corta\n\n${SIGNATURE}`);
  });
});

describe("parseComments (round-trip)", () => {
  it("extrae notas, expansiones, variante y firma", () => {
    const raw = composeComments({
      notes: "Mis notas\ncon dos líneas",
      expansions: [
        { id: 1, name: "Exp A" },
        { id: 2, name: "Exp B" },
      ],
      variant: "Mapa Norte",
      sign: true,
    });
    const parsed = parseComments(raw);
    expect(parsed.notes).toBe("Mis notas\ncon dos líneas");
    expect(parsed.expansions).toEqual([
      { id: 1, name: "Exp A" },
      { id: 2, name: "Exp B" },
    ]);
    expect(parsed.variant).toBe("Mapa Norte");
    expect(parsed.signed).toBe(true);
  });

  it("comentario sin bloques → todo es nota, signed false", () => {
    const parsed = parseComments("Sólo un comentario libre");
    expect(parsed).toEqual({
      notes: "Sólo un comentario libre",
      expansions: [],
      variant: "",
      signed: false,
    });
  });

  it("recompone igual tras parsear (idempotente con sign)", () => {
    const raw = composeComments({
      notes: "N",
      expansions: [{ id: 9, name: "E" }],
      variant: "V",
      sign: true,
    });
    const p = parseComments(raw);
    const again = composeComments({
      notes: p.notes,
      expansions: p.expansions,
      variant: p.variant,
      sign: p.signed,
    });
    expect(again).toBe(raw);
  });

  it("vacío → estructura vacía", () => {
    expect(parseComments("")).toEqual({
      notes: "",
      expansions: [],
      variant: "",
      signed: false,
    });
  });
});
