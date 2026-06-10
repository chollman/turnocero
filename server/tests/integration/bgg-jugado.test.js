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
    expect(res.body).toEqual({ played: false, numPlays: 0, known: true });
  });

  it("known:false cuando el usuario no tiene ninguna partida sincronizada", async () => {
    const res = await request(app).get("/api/bgg/jugado/fantasma/100");
    expect(res.body).toEqual({ played: false, numPlays: 0, known: false });
  });

  it("played:true con numPlays = suma de quantity", async () => {
    await BggPlay.create(playDoc({ gameId: "100", quantity: 2 }));
    await BggPlay.create(playDoc({ gameId: "100", quantity: 1 }));
    const res = await request(app).get("/api/bgg/jugado/alice/100");
    expect(res.body).toEqual({ played: true, numPlays: 3, known: true });
  });

  it("es case-insensitive en el username", async () => {
    await BggPlay.create(playDoc({ bggUsername: "alice", gameId: "100" }));
    const res = await request(app).get("/api/bgg/jugado/Alice/100");
    expect(res.body.played).toBe(true);
  });
});

describe("POST /api/bgg/nuevos/:user/:gameId", () => {
  it("marca nuevo a un invitado sin sync la primera vez en ese juego", async () => {
    // El dueño tiene partidas (otro juego), pero nunca anotó a Nico en el 100.
    await BggPlay.create(
      playDoc({ gameId: "200", players: [{ username: "alice", win: true }] }),
    );
    const res = await request(app)
      .post("/api/bgg/nuevos/alice/100")
      .send({ players: [{ name: "Nico del Dot", username: "" }] });
    expect(res.status).toBe(200);
    expect(res.body.flags["n:nico del dot"]).toBe(true);
  });

  it("no lo marca si ya apareció en una partida del dueño de ese juego", async () => {
    await BggPlay.create(
      playDoc({
        gameId: "100",
        players: [
          { username: "alice" },
          { name: "Nico del Dot", username: "" },
        ],
      }),
    );
    const res = await request(app)
      .post("/api/bgg/nuevos/alice/100")
      .send({ players: [{ name: "Nico del Dot", username: "" }] });
    expect(res.body.flags["n:nico del dot"]).toBe(false);
  });

  it("dueño sin sync → no marca a nadie (sin falsos positivos)", async () => {
    const res = await request(app)
      .post("/api/bgg/nuevos/fantasma/100")
      .send({ players: [{ name: "Nico del Dot", username: "" }] });
    expect(res.body.flags["n:nico del dot"]).toBe(false);
  });

  it("roster vacío o ausente devuelve flags vacíos", async () => {
    const res = await request(app).post("/api/bgg/nuevos/alice/100").send({});
    expect(res.status).toBe(200);
    expect(res.body.flags).toEqual({});
  });
});
