const request = require("supertest");
const app = require("../../app");
const BggPlay = require("../../models/BggPlay");

// GET /api/bgg/jugado/:user/:gameId — ¿el usuario jugó ese juego antes?
// Alimenta la autodetección del flag "Nuevo" al cargar una partida.

function playDoc(overrides) {
  return {
    bggUsername: "alice",
    playId: String(Math.floor(Math.random() * 1e9)),
    gameId: "100",
    gameName: "Catan",
    date: "2026-01-01",
    quantity: 1,
    players: [],
    hash: "x".repeat(40),
    ...overrides,
  };
}

describe("GET /api/bgg/jugado/:user/:gameId", () => {
  it("played:false (de ese juego) pero known:true si tiene otras partidas", async () => {
    await BggPlay.create(playDoc({ gameId: "100" }));
    const res = await request(app).get("/api/bgg/jugado/alice/200");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      played: false,
      numPlays: 0,
      avgDuration: null,
      known: true,
    });
  });

  it("known:false cuando el usuario no tiene ninguna partida sincronizada", async () => {
    const res = await request(app).get("/api/bgg/jugado/fantasma/100");
    expect(res.body).toEqual({
      played: false,
      numPlays: 0,
      avgDuration: null,
      known: false,
    });
  });

  it("played:true con numPlays = suma de quantity", async () => {
    await BggPlay.create(playDoc({ gameId: "100", quantity: 2 }));
    await BggPlay.create(playDoc({ gameId: "100", quantity: 1 }));
    const res = await request(app).get("/api/bgg/jugado/alice/100");
    expect(res.body).toMatchObject({ played: true, numPlays: 3, known: true });
  });

  it("avgDuration es el promedio (min) de las partidas de ese juego", async () => {
    await BggPlay.create(playDoc({ gameId: "100", duration: 60 }));
    await BggPlay.create(playDoc({ gameId: "100", duration: 90 }));
    const res = await request(app).get("/api/bgg/jugado/alice/100");
    expect(res.body.avgDuration).toBe(75);
  });

  it("es case-insensitive en el username", async () => {
    await BggPlay.create(playDoc({ bggUsername: "alice", gameId: "100" }));
    const res = await request(app).get("/api/bgg/jugado/Alice/100");
    expect(res.body.played).toBe(true);
  });
});
