const request = require("supertest");
const app = require("../../app");
const BggPlay = require("../../models/BggPlay");
const BggGame = require("../../models/BggGame");
const { _resetForTests } = require("../../services/bgg/bggCache");

// Igual que bgg-comunidad.test.js: la ruta enriquece los juegos vía
// resolveGamesBatch — seedeamos BggGame (resuelve desde Mongo, sin red) y
// reseteamos la L1 cache entre tests para que el enriquecido sea
// determinístico.
beforeEach(async () => {
  _resetForTests();
  await BggGame.insertMany(
    [100, 200].map((id) => ({
      gameId: id,
      name: `Game ${id}`,
      thumbnail: `thumb-${id}`,
      image: `image-${id}`,
    })),
  );
});

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

describe("GET /api/bgg/partidas-del-mes/:bggUsername", () => {
  it("400 si falta mindate o maxdate", async () => {
    const res1 = await request(app).get(
      "/api/bgg/partidas-del-mes/alice?maxdate=2026-06-30",
    );
    expect(res1.status).toBe(400);
    const res2 = await request(app).get(
      "/api/bgg/partidas-del-mes/alice?mindate=2026-06-01",
    );
    expect(res2.status).toBe(400);
  });

  it("400 si el formato de fecha es inválido", async () => {
    const res = await request(app).get(
      "/api/bgg/partidas-del-mes/alice?mindate=01-06-2026&maxdate=2026-06-30",
    );
    expect(res.status).toBe(400);
  });

  it("400 si mindate es posterior a maxdate", async () => {
    const res = await request(app).get(
      "/api/bgg/partidas-del-mes/alice?mindate=2026-06-30&maxdate=2026-06-01",
    );
    expect(res.status).toBe(400);
  });

  it("devuelve stats en cero y games vacío para un usuario sin partidas en el rango", async () => {
    const res = await request(app).get(
      "/api/bgg/partidas-del-mes/ghost?mindate=2026-06-01&maxdate=2026-06-30",
    );
    expect(res.status).toBe(200);
    expect(res.body.range).toEqual({ mindate: "2026-06-01", maxdate: "2026-06-30" });
    expect(res.body.stats.totalPlays).toBe(0);
    expect(res.body.games).toEqual([]);
  });

  it("agrega stats + games del período, enriquecidos con image", async () => {
    await BggPlay.create(
      play({
        gameId: "100",
        date: "2026-06-05",
        quantity: 2,
        players: [{ username: "alice", win: true }],
      }),
    );
    await BggPlay.create(
      play({
        gameId: "200",
        gameName: "Risk",
        date: "2026-06-20",
        quantity: 1,
        players: [{ username: "alice", win: false }],
      }),
    );
    // Fuera del rango — no debe contarse.
    await BggPlay.create(play({ gameId: "100", date: "2026-07-01" }));

    const res = await request(app).get(
      "/api/bgg/partidas-del-mes/alice?mindate=2026-06-01&maxdate=2026-06-30",
    );
    expect(res.status).toBe(200);
    expect(res.body.stats.totalPlays).toBe(3);
    expect(res.body.stats.totalWins).toBe(1);
    expect(res.body.stats.uniqueGames).toBe(2);

    const games = res.body.games;
    expect(games).toHaveLength(2);
    const catan = games.find((g) => g.id === "100");
    const risk = games.find((g) => g.id === "200");
    expect(catan).toMatchObject({ numPlays: 2, image: "image-100" });
    expect(risk).toMatchObject({ numPlays: 1, image: "image-200" });
  });

  it("es case-insensitive en el username de la ruta", async () => {
    await BggPlay.create(play({ bggUsername: "alice", date: "2026-06-05" }));
    const res = await request(app).get(
      "/api/bgg/partidas-del-mes/ALICE?mindate=2026-06-01&maxdate=2026-06-30",
    );
    expect(res.status).toBe(200);
    expect(res.body.stats.totalPlays).toBe(1);
  });
});
