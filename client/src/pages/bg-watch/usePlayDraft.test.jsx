import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import usePlayDraft, { draftKey, isDraftMeaningful } from "./usePlayDraft";

beforeEach(() => localStorage.clear());

describe("draftKey", () => {
  it("scopea por usuario en lowercase", () => {
    expect(draftKey("MeBGG")).toBe("turnocero_play_draft:mebgg");
    expect(draftKey()).toBe("turnocero_play_draft:");
  });
});

describe("isDraftMeaningful", () => {
  it("false para null o form en blanco (solo el dueño)", () => {
    expect(isDraftMeaningful(null)).toBe(false);
    expect(
      isDraftMeaningful({
        game: null,
        players: [{ name: "Me", username: "meBGG", score: "", win: false }],
        details: {},
      }),
    ).toBe(false);
  });

  it("true si hay juego elegido", () => {
    expect(isDraftMeaningful({ game: { id: "1" }, players: [] })).toBe(true);
  });

  it("true si hay más de un jugador", () => {
    expect(
      isDraftMeaningful({ players: [{ name: "Me" }, { name: "Bob" }] }),
    ).toBe(true);
  });

  it("true si un jugador tiene puntaje o ganó", () => {
    expect(isDraftMeaningful({ players: [{ score: "10" }] })).toBe(true);
    expect(isDraftMeaningful({ players: [{ win: true }] })).toBe(true);
  });

  it("true si hay ubicación, comentarios o duración", () => {
    expect(isDraftMeaningful({ players: [], details: { location: "Club" } })).toBe(
      true,
    );
    expect(isDraftMeaningful({ players: [], details: { comments: "hola" } })).toBe(
      true,
    );
    expect(isDraftMeaningful({ players: [], details: { length: 60 } })).toBe(
      true,
    );
  });
});

describe("usePlayDraft", () => {
  it("save → load round-trips el borrador", () => {
    const { result } = renderHook(() => usePlayDraft("meBGG"));
    const draft = { game: { id: "13" }, details: {}, players: [] };
    act(() => result.current.save(draft));
    expect(result.current.load()).toEqual(draft);
    // Persistido bajo la key scopeada por usuario.
    expect(
      JSON.parse(localStorage.getItem("turnocero_play_draft:mebgg")),
    ).toEqual(draft);
  });

  it("clear borra el borrador", () => {
    const { result } = renderHook(() => usePlayDraft("meBGG"));
    act(() => result.current.save({ game: { id: "1" }, players: [] }));
    act(() => result.current.clear());
    expect(result.current.load()).toBeNull();
  });

  it("load devuelve null con JSON corrupto", () => {
    localStorage.setItem("turnocero_play_draft:mebgg", "{not json");
    const { result } = renderHook(() => usePlayDraft("meBGG"));
    expect(result.current.load()).toBeNull();
  });
});
