const request = require("supertest");
const app = require("../../app");
const BggPlay = require("../../models/BggPlay");

let seq = 0;
function play(overrides = {}) {
  seq += 1;
  return {
    bggUsername: "alice",
    playId: `p${seq}`,
    gameId: "100",
    gameName: "Catan",
    date: "2026-06-01",
    quantity: 1,
    duration: 60,
    players: [{ username: "alice", win: true, score: "10" }],
    hash: String(seq).padStart(40, "0"),
    ...overrides,
  };
}

describe("GET /api/bgg/resumen/:bggUsername", () => {
  it("devuelve la forma de ceros para un usuario sin partidas", async () => {
    const res = await request(app).get("/api/bgg/resumen/ghost");
    expect(res.status).toBe(200);
    expect(res.body.overallStats).toEqual({
      totalWins: 0,
      totalRated: 0,
      totalPlays: 0,
      uniqueGames: 0,
      avgDuration: null,
      firstDate: null,
      lastDate: null,
    });
    expect(res.body.heatmap).toEqual([]);
  });

  it("agrega overallStats sobre todo el log del usuario", async () => {
    await BggPlay.create(
      play({
        gameId: "100",
        quantity: 2,
        players: [{ username: "alice", win: true }],
      }),
    );
    await BggPlay.create(
      play({
        gameId: "200",
        quantity: 1,
        players: [{ username: "alice", win: false }],
      }),
    );
    const res = await request(app).get("/api/bgg/resumen/alice");
    expect(res.status).toBe(200);
    const s = res.body.overallStats;
    expect(s.totalPlays).toBe(3);
    expect(s.totalRated).toBe(2);
    expect(s.totalWins).toBe(1);
    expect(s.uniqueGames).toBe(2);
  });

  it("el heatmap refleja las partidas dentro de la ventana", async () => {
    await BggPlay.create(play({ date: "2026-06-01", quantity: 2 }));
    await BggPlay.create(play({ date: "2026-06-01", quantity: 1 }));
    const res = await request(app).get("/api/bgg/resumen/alice");
    const day = res.body.heatmap.find((d) => d.date === "2026-06-01");
    expect(day.count).toBe(3);
  });

  it("es case-insensitive en el username de la ruta", async () => {
    await BggPlay.create(play({ bggUsername: "alice", quantity: 4 }));
    const res = await request(app).get("/api/bgg/resumen/ALICE");
    expect(res.status).toBe(200);
    expect(res.body.overallStats.totalPlays).toBe(4);
  });
});
