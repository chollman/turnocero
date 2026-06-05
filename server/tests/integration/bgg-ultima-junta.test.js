const request = require("supertest");
const app = require("../../app");
const BggPlay = require("../../models/BggPlay");

// GET /api/bgg/ultima-junta/:user — roster + ubicación de la partida más
// reciente del usuario, para el botón "Usar última junta" del form de carga.

function playDoc(overrides) {
  return {
    bggUsername: "alice",
    playId: String(Math.floor(Math.random() * 1e9)),
    gameId: "100",
    gameName: "Catan",
    date: "2026-01-01",
    quantity: 1,
    players: [{ name: "Alice", username: "alice" }],
    hash: "x".repeat(40),
    ...overrides,
  };
}

describe("GET /api/bgg/ultima-junta/:user", () => {
  it("devuelve { junta: null } cuando no hay partidas", async () => {
    const res = await request(app).get("/api/bgg/ultima-junta/nadie");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ junta: null });
  });

  it("devuelve el roster + ubicación de la última partida", async () => {
    await BggPlay.create(
      playDoc({
        date: "2026-02-01",
        location: "Casa",
        players: [
          { name: "Alice", username: "alice" },
          { name: "Bob", username: "bob" },
        ],
      }),
    );
    await BggPlay.create(
      playDoc({
        date: "2026-05-01",
        location: "Club",
        players: [
          { name: "Alice", username: "alice", score: "9", win: true },
          { name: "Carla", username: "carla" },
        ],
      }),
    );
    const res = await request(app).get("/api/bgg/ultima-junta/alice");
    expect(res.status).toBe(200);
    expect(res.body.junta.location).toBe("Club");
    expect(res.body.junta.players).toEqual([
      { name: "Alice", username: "alice" },
      { name: "Carla", username: "carla" },
    ]);
  });

  it("es case-insensitive en el username de la URL", async () => {
    await BggPlay.create(playDoc({ date: "2026-04-01", location: "Bar" }));
    const res = await request(app).get("/api/bgg/ultima-junta/ALICE");
    expect(res.status).toBe(200);
    expect(res.body.junta.location).toBe("Bar");
  });
});
