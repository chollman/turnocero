const request = require("supertest");
const app = require("../../app");
const BggPlay = require("../../models/BggPlay");

// GET /api/bgg/mis-jugadores/:user — selector paginado de compañeros, derivado
// de los players de las partidas del usuario (excluye al propio dueño).

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

describe("GET /api/bgg/mis-jugadores/:user (paginado)", () => {
  async function seed() {
    await BggPlay.create(
      playDoc({
        date: "2026-03-01",
        players: [
          { name: "Alice", username: "alice" },
          { name: "Bob", username: "bob" },
        ],
      }),
    );
    await BggPlay.create(
      playDoc({
        date: "2026-02-01",
        players: [
          { name: "Alice", username: "alice" },
          { name: "Carla", username: "carla" },
          { name: "Tía Susana", username: "" },
        ],
      }),
    );
  }

  it("devuelve compañeros ordenados por recencia, sin el dueño", async () => {
    await seed();
    const res = await request(app).get("/api/bgg/mis-jugadores/alice");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3); // Bob, Carla, Tía Susana (alice excluida)
    expect(res.body.items.map((p) => p.name)).toEqual([
      "Bob", // 2026-03-01
      "Carla", // 2026-02-01
      "Tía Susana", // 2026-02-01
    ]);
  });

  it("pagina sin solapamiento", async () => {
    await seed();
    const p1 = await request(app).get(
      "/api/bgg/mis-jugadores/alice?limit=2&page=1",
    );
    expect(p1.body.items.map((p) => p.name)).toEqual(["Bob", "Carla"]);
    expect(p1.body.pages).toBe(2);
    const p2 = await request(app).get(
      "/api/bgg/mis-jugadores/alice?limit=2&page=2",
    );
    expect(p2.body.items.map((p) => p.name)).toEqual(["Tía Susana"]);
  });

  it("?q filtra por nombre o username (accent/case-insensitive)", async () => {
    await seed();
    const res = await request(app).get("/api/bgg/mis-jugadores/alice?q=susana");
    expect(res.body.items.map((p) => p.name)).toEqual(["Tía Susana"]);
  });

  it("lista vacía cuando no hay compañeros", async () => {
    const res = await request(app).get("/api/bgg/mis-jugadores/nadie");
    expect(res.body).toEqual({ items: [], total: 0, page: 1, pages: 0 });
  });
});
