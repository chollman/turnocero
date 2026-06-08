import { describe, it, expect } from "vitest";
import { buildPlayResult } from "./buildPlayResult";

const ROWS = [
  {
    key: "0-me",
    name: "Martín",
    username: "martin",
    anonymous: false,
    score: 85,
    win: true,
    new: false,
    team: "",
    position: 1,
    you: true,
    leader: true,
  },
  {
    key: "1-bob",
    name: "Bob",
    username: "bob",
    anonymous: false,
    score: 72,
    win: false,
    new: true,
    team: "",
    position: 2,
    you: false,
    leader: false,
  },
];

describe("buildPlayResult", () => {
  it("devuelve null sin juego o sin filas", () => {
    expect(buildPlayResult({ scorecardRows: ROWS, mode: "versus" })).toBeNull();
    expect(
      buildPlayResult({ scorecardRows: [], mode: "versus", game: { id: 1 } }),
    ).toBeNull();
    expect(buildPlayResult()).toBeNull();
  });

  it("arma el snapshot conservando mode, juego, fecha, duración y jugadores", () => {
    const snap = buildPlayResult({
      scorecardRows: ROWS,
      mode: "versus",
      game: { id: "13", name: "Catán", thumbnail: "t.jpg" },
      details: { playdate: "2026-06-08", length: "60" },
    });
    expect(snap.mode).toBe("versus");
    expect(snap.game).toEqual({ name: "Catán", thumbnail: "t.jpg" });
    expect(snap.gameId).toBe(13);
    expect(snap.date).toBe("2026-06-08");
    expect(snap.duration).toBe(60);
    expect(snap.players).toHaveLength(2);
  });

  it("descarta los campos viewer-relativos (you/leader/key) y NO incluye ubicación", () => {
    const snap = buildPlayResult({
      scorecardRows: ROWS,
      mode: "versus",
      game: { id: 13, name: "Catán" },
      details: { playdate: "2026-06-08", length: "", location: "Casa" },
    });
    const p0 = snap.players[0];
    expect(p0).not.toHaveProperty("you");
    expect(p0).not.toHaveProperty("leader");
    expect(p0).not.toHaveProperty("key");
    expect(snap).not.toHaveProperty("location");
    expect(snap.duration).toBeNull(); // length "" → null
  });

  it("coerciona score a string y mantiene win/new/team/position", () => {
    const snap = buildPlayResult({
      scorecardRows: ROWS,
      mode: "versus",
      game: { id: 13, name: "Catán" },
      details: { playdate: "2026-06-08" },
    });
    expect(snap.players[0]).toMatchObject({
      name: "Martín",
      username: "martin",
      score: "85",
      win: true,
      new: false,
      team: "",
      position: 1,
    });
    expect(snap.players[1].score).toBe("72");
    expect(snap.players[1].new).toBe(true);
  });

  it("mode default 'versus' si no se pasa", () => {
    const snap = buildPlayResult({
      scorecardRows: ROWS,
      game: { id: 13, name: "Catán" },
    });
    expect(snap.mode).toBe("versus");
  });
});
