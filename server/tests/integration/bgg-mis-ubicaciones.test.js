const request = require("supertest");
const app = require("../../app");
const BggPlay = require("../../models/BggPlay");

// GET /api/bgg/mis-ubicaciones/:user — selector paginado de ubicaciones.
// Deriva las ubicaciones distintas de las partidas del usuario (siempre fresco,
// sin materializar), con ?page/?limit/?q. Orden: más recientemente usada
// primero, luego más partidas, luego alfabético.

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

describe("GET /api/bgg/mis-ubicaciones/:user (paginado)", () => {
  async function seedAlice() {
    await BggPlay.create(
      playDoc({ playId: "1", location: "Casa", date: "2026-02-01" }),
    );
    await BggPlay.create(
      playDoc({ playId: "2", location: "Casa", date: "2026-03-01" }),
    );
    await BggPlay.create(
      playDoc({ playId: "3", location: "Club", date: "2026-01-15" }),
    );
    await BggPlay.create(
      playDoc({ playId: "4", location: "Café Müller", date: "2026-01-10" }),
    );
    // Sin ubicación → no aparece.
    await BggPlay.create(playDoc({ playId: "5", location: null }));
  }

  it("devuelve { items, total, page, pages } ordenado por recencia desc", async () => {
    await seedAlice();
    const res = await request(app).get("/api/bgg/mis-ubicaciones/alice");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
    expect(res.body.pages).toBe(1);
    expect(res.body.items.map((l) => l.name)).toEqual([
      "Casa", // 2026-03-01
      "Club", // 2026-01-15
      "Café Müller", // 2026-01-10
    ]);
    expect(res.body.items[0]).toEqual({
      name: "Casa",
      numPlays: 2,
      lastPlayedDate: "2026-03-01",
    });
  });

  it("pagina con ?limit + ?page sin solapamiento", async () => {
    await seedAlice();
    const p1 = await request(app).get(
      "/api/bgg/mis-ubicaciones/alice?limit=2&page=1",
    );
    expect(p1.body.items.map((l) => l.name)).toEqual(["Casa", "Club"]);
    expect(p1.body.total).toBe(3);
    expect(p1.body.pages).toBe(2);

    const p2 = await request(app).get(
      "/api/bgg/mis-ubicaciones/alice?limit=2&page=2",
    );
    expect(p2.body.items.map((l) => l.name)).toEqual(["Café Müller"]);
  });

  it("?q filtra por nombre (accent/case-insensitive, substring)", async () => {
    await seedAlice();
    const res = await request(app).get(
      "/api/bgg/mis-ubicaciones/alice?q=muller",
    );
    expect(res.body.items.map((l) => l.name)).toEqual(["Café Müller"]);
    expect(res.body.total).toBe(1);
  });

  it("lista vacía cuando el usuario no tiene ubicaciones", async () => {
    const res = await request(app).get("/api/bgg/mis-ubicaciones/nadie");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], total: 0, page: 1, pages: 0 });
  });

  it("filtra por usuario", async () => {
    await seedAlice();
    await BggPlay.create(
      playDoc({ bggUsername: "bob", playId: "9", location: "Oficina" }),
    );
    const res = await request(app).get("/api/bgg/mis-ubicaciones/bob");
    expect(res.body.items.map((l) => l.name)).toEqual(["Oficina"]);
  });
});
