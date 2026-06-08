const request = require("supertest");
const app = require("../../app");
const BggGameVariant = require("../../models/BggGameVariant");

describe("GET /api/bgg/variantes/:bggUsername/:gameId", () => {
  it("devuelve las variantes del usuario para el juego, más recientes primero", async () => {
    await BggGameVariant.create([
      {
        bggUsername: "alice",
        gameId: "13",
        name: "Escenario 1",
        lastUsedAt: new Date("2026-01-01"),
      },
      {
        bggUsername: "alice",
        gameId: "13",
        name: "Mapa Norte",
        lastUsedAt: new Date("2026-05-01"),
      },
      // Otro juego del mismo user — no debe aparecer.
      { bggUsername: "alice", gameId: "99", name: "Otro" },
      // Otro user — no debe aparecer.
      { bggUsername: "bob", gameId: "13", name: "De Bob" },
    ]);

    const res = await request(app).get("/api/bgg/variantes/alice/13");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual(["Mapa Norte", "Escenario 1"]);
  });

  it("es case-insensitive en el username y devuelve [] si no hay", async () => {
    await BggGameVariant.create({
      bggUsername: "alice",
      gameId: "13",
      name: "X",
    });
    const hit = await request(app).get("/api/bgg/variantes/ALICE/13");
    expect(hit.body.items).toEqual(["X"]);

    const miss = await request(app).get("/api/bgg/variantes/alice/77");
    expect(miss.body.items).toEqual([]);
  });

  it("el índice único evita duplicar (user, juego, nombre)", async () => {
    await BggGameVariant.create({
      bggUsername: "alice",
      gameId: "13",
      name: "Repe",
    });
    await expect(
      BggGameVariant.create({
        bggUsername: "alice",
        gameId: "13",
        name: "Repe",
      }),
    ).rejects.toThrow();
  });
});
