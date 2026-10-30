import { describe, it, expect } from "vitest";
import { draftToFormValues } from "./draftToFormValues";
import { parseComments } from "./playComments";

const base = {
  game: { id: "13", name: "Catan", thumbnail: "t.jpg" },
  details: {
    playdate: "2026-10-29",
    length: 90,
    location: "Casa",
    comments: "Revancha",
  },
  mode: "versus",
  coopResult: null,
  variant: "Mapa de invierno",
  expansions: [{ id: "325", name: "Seafarers" }],
  players: [
    {
      name: "Claudio",
      username: "claudio",
      score: "10",
      win: true,
      team: "",
      faction: "Marquesa",
    },
    {
      name: "Juan",
      username: "",
      score: "8",
      win: false,
      team: "",
      faction: "",
    },
  ],
};

describe("draftToFormValues", () => {
  it("returns null without a game", () => {
    expect(draftToFormValues(null)).toBeNull();
    expect(draftToFormValues({ players: [] })).toBeNull();
  });

  it("maps game, details and players for PlayForm", () => {
    const v = draftToFormValues(base);
    expect(v.game).toEqual({
      id: 13,
      name: "Catan",
      thumbnail: "t.jpg",
      image: null,
      year: null,
    });
    expect(v.details).toMatchObject({
      playdate: "2026-10-29",
      length: 90,
      location: "Casa",
    });
    expect(v.players).toEqual([
      {
        name: "Claudio",
        username: "claudio",
        score: "10",
        win: true,
        color: "Marquesa",
      },
      { name: "Juan", username: "", score: "8", win: false, color: "" },
    ]);
    expect(v).toMatchObject({ mode: "versus", fromAgent: true });
  });

  it("packs notes, variant and expansions into comments without a signature", () => {
    const parsed = parseComments(draftToFormValues(base).details.comments);
    expect(parsed).toEqual({
      notes: "Revancha",
      expansions: [{ id: 325, name: "Seafarers" }],
      variant: "Mapa de invierno",
      signed: false,
    });
  });

  it("stores the team in color for equipos mode", () => {
    const v = draftToFormValues({
      ...base,
      mode: "equipos",
      players: [
        { name: "A", username: "a", team: "A", win: true, faction: "x" },
        { name: "B", username: "b", team: "B" },
      ],
    });
    expect(v.players.map((p) => p.color)).toEqual(["Equipo A", "Equipo B"]);
  });

  it("drops scores in coop mode and keeps the result", () => {
    const v = draftToFormValues({ ...base, mode: "coop", coopResult: "lost" });
    expect(v.players.every((p) => p.score === "")).toBe(true);
    expect(v.coopWin).toBe(false);
  });
});
