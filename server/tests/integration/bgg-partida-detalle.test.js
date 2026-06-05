const request = require("supertest");
const app = require("../../app");
const BggPlay = require("../../models/BggPlay");
const { createAuthedUser, authHeader } = require("../helpers/auth");

// GET /api/bgg/partida/:bggUsername/:playId — precarga una partida para editar.
// Solo el dueño (case-insensitive) o admin.

function playDoc(overrides) {
  return {
    bggUsername: "alice",
    playId: "play-1",
    gameId: "100",
    gameName: "Catan",
    gameThumbnail: "t100",
    date: "2026-03-01",
    duration: 60,
    location: "Casa",
    quantity: 1,
    comments: "buena",
    incomplete: false,
    nowinstats: false,
    players: [{ name: "Alice", username: "alice", win: true, score: "10" }],
    hash: "x".repeat(40),
    ...overrides,
  };
}

describe("GET /api/bgg/partida/:bggUsername/:playId", () => {
  it("401 sin autenticación", async () => {
    const res = await request(app).get("/api/bgg/partida/alice/play-1");
    expect(res.status).toBe(401);
  });

  it("el dueño obtiene la partida con la shape esperada", async () => {
    const { token } = await createAuthedUser({ bggUsername: "alice" });
    await BggPlay.create(playDoc());
    const res = await request(app)
      .get("/api/bgg/partida/alice/play-1")
      .set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: "play-1",
      gameId: "100",
      gameName: "Catan",
      gameThumbnail: "t100",
      date: "2026-03-01",
      duration: 60,
      location: "Casa",
      quantity: 1,
      comments: "buena",
      incomplete: false,
      nowinstats: false,
    });
    expect(res.body.players).toHaveLength(1);
    expect(res.body.players[0]).toMatchObject({ username: "alice", win: true });
  });

  it("matchea el dueño case-insensitive", async () => {
    const { token } = await createAuthedUser({ bggUsername: "Alice" });
    await BggPlay.create(playDoc());
    const res = await request(app)
      .get("/api/bgg/partida/alice/play-1")
      .set(authHeader(token));
    expect(res.status).toBe(200);
  });

  it("403 si no es el dueño", async () => {
    const { token } = await createAuthedUser({ bggUsername: "bob" });
    await BggPlay.create(playDoc());
    const res = await request(app)
      .get("/api/bgg/partida/alice/play-1")
      .set(authHeader(token));
    expect(res.status).toBe(403);
  });

  it("404 si la partida no existe", async () => {
    const { token } = await createAuthedUser({ bggUsername: "alice" });
    const res = await request(app)
      .get("/api/bgg/partida/alice/nope")
      .set(authHeader(token));
    expect(res.status).toBe(404);
  });
});
