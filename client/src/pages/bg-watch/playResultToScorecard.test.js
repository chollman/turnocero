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

  it("setea publicView, userMap vacío (sin userId) y you=false en todas las filas", () => {
    const props = playResultToScorecardProps(versus);
    expect(props.publicView).toBe(true);
    expect(props.userMap).toEqual({});
    expect(props.rows.every((r) => r.you === false)).toBe(true);
  });

  it("usuario de TurnoCero (userId poblado): nombre EN VIVO + entrada en userMap", () => {
    const props = playResultToScorecardProps({
      ...versus,
      players: [
        {
          name: "Martín", // snapshot viejo
          username: "martin",
          // userId poblado por el server con el perfil ACTUAL.
          userId: {
            _id: "u1",
            username: "tincho",
            displayName: "Martín Pérez",
            avatar: { url: "a.jpg", publicId: "", color: "" },
          },
          score: "85",
          win: true,
          position: 1,
        },
        { name: "Bob", username: "bob", score: "72", win: false, position: 2 },
      ],
    });
    // La fila usa el displayName actual, no el snapshot "Martín".
    expect(props.rows[0].name).toBe("Martín Pérez");
    // userMap keyeado por @BGG → el avatar lo resuelve el Scorecard.
    expect(props.userMap.martin).toMatchObject({ _id: "u1" });
    // Link al perfil público de TurnoCero + a su BG Watch.
    expect(props.rows[0].profileHref).toBe("/usuarios/u1");
    expect(props.rows[0].bgwatchHref).toBe("/bg-watch/martin");
    // El jugador sin userId no entra al map y mantiene su nombre de snapshot.
    expect(props.rows[1].name).toBe("Bob");
    expect(props.userMap.bob).toBeUndefined();
    // Sin cuenta TC: no hay link a perfil, pero sí a BG Watch (tiene @BGG).
    expect(props.rows[1].profileHref).toBeNull();
    expect(props.rows[1].bgwatchHref).toBe("/bg-watch/bob");
  });

  it("hrefs: anónimo y jugador sin @BGG no linkean a BG Watch", () => {
    const props = playResultToScorecardProps({
      ...versus,
      players: [
        { name: "Anónimo", username: "", anonymous: true, position: 1 },
        { name: "Suelto", username: "", position: 2 },
        { name: "Conhandle", username: "Pé Pe", position: 3 },
      ],
    });
    expect(props.rows[0].bgwatchHref).toBeNull(); // anónimo
    expect(props.rows[1].bgwatchHref).toBeNull(); // sin @BGG
    expect(props.rows[0].profileHref).toBeNull();
    // @BGG con caracteres especiales → URL-encodeado.
    expect(props.rows[2].bgwatchHref).toBe("/bg-watch/P%C3%A9%20Pe");
  });

  it("ignora userId que no viene poblado (string id) → cae al snapshot", () => {
    const props = playResultToScorecardProps({
      ...versus,
      players: [
        { name: "Martín", username: "martin", userId: "u1", position: 1 },
      ],
    });
    expect(props.rows[0].name).toBe("Martín");
    expect(props.userMap).toEqual({});
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
