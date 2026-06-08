import { describe, it, expect } from "vitest";
import { playResultToScorecardProps } from "./playResultToScorecard";

const versus = {
  mode: "versus",
  game: { name: "Catán", thumbnail: "t.jpg" },
  date: "2026-06-08",
  duration: 60,
  players: [
    { name: "Martín", username: "martin", score: "85", win: true, position: 1 },
    { name: "Bob", username: "bob", score: "72", win: false, position: 2 },
  ],
};

describe("playResultToScorecardProps", () => {
  it("null → null", () => {
    expect(playResultToScorecardProps(null)).toBeNull();
    expect(playResultToScorecardProps(undefined)).toBeNull();
  });

  it("setea publicView, userMap vacío y you=false en todas las filas", () => {
    const props = playResultToScorecardProps(versus);
    expect(props.publicView).toBe(true);
    expect(props.userMap).toEqual({});
    expect(props.rows.every((r) => r.you === false)).toBe(true);
  });

  it("versus: el líder es la única fila en posición 1 con score numérico", () => {
    const props = playResultToScorecardProps(versus);
    expect(props.rows[0].leader).toBe(true);
    expect(props.rows[1].leader).toBe(false);
  });

  it("versus sin scores numéricos: nadie es líder", () => {
    const props = playResultToScorecardProps({
      ...versus,
      players: [
        { name: "A", score: "", win: false, position: 1 },
        { name: "B", score: "", win: false, position: 1 },
      ],
    });
    expect(props.rows.every((r) => r.leader === false)).toBe(true);
  });

  it("equipos: líder = los del equipo ganador (win)", () => {
    const props = playResultToScorecardProps({
      mode: "equipos",
      game: { name: "X" },
      players: [
        { name: "A", team: "A", win: true, position: 1 },
        { name: "B", team: "B", win: false, position: 2 },
      ],
    });
    expect(props.rows[0].leader).toBe(true);
    expect(props.rows[1].leader).toBe(false);
  });

  it("coop: nadie es líder (corona oculta)", () => {
    const props = playResultToScorecardProps({
      mode: "coop",
      game: { name: "Pandemic" },
      players: [
        { name: "A", win: true },
        { name: "B", win: true },
      ],
    });
    expect(props.rows.every((r) => r.leader === false)).toBe(true);
  });

  it("pasa game/date/duration y oculta location/notes", () => {
    const props = playResultToScorecardProps(versus);
    expect(props.game).toEqual({ name: "Catán", thumbnail: "t.jpg" });
    expect(props.date).toBe("2026-06-08");
    expect(props.duration).toBe(60);
    expect(props.location).toBe("");
    expect(props.notes).toBe("");
  });
});
