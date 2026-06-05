const request = require("supertest");
const app = require("../../app");
const BggPlay = require("../../models/BggPlay");
const BggCollection = require("../../models/BggCollection");
const User = require("../../models/User");
const { createUser } = require("../helpers/auth");
const bggRouter = require("../../routes/bgg");

// GET /api/bgg/mis-juegos/:user — selector paginado. Sirve desde el cache
// materializado BggUserGame (reconstruido lazy desde BggPlay + BggCollection),
// con ?page/?limit/?q. Orden: más recientemente jugado primero.

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

describe("GET /api/bgg/mis-juegos/:user (paginado)", () => {
  beforeEach(() => {
    bggRouter.__resetCache();
    // Colección no-seedeada → resolveCollection falla rápido (solo jugados).
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => "",
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
  });

  async function seedAlice() {
    await createUser({ bggUsername: "alice" });
    await BggPlay.create(playDoc({ playId: "1", gameId: "100", date: "2026-02-01" }));
    await BggPlay.create(
      playDoc({ playId: "2", gameId: "100", date: "2026-03-01", gameThumbnail: "p100" }),
    );
    await BggPlay.create(
      playDoc({ playId: "3", gameId: "200", gameName: "Risk", date: "2026-01-01" }),
    );
    await BggCollection.create({
      bggUsername: "alice",
      lastFetchedAt: new Date(),
      games: [
        {
          id: "100",
          name: "Catan",
          thumbnail: "c100",
          image: "img100",
          yearPublished: 1995,
          numPlays: 9,
        },
        {
          id: "300",
          name: "Azul",
          thumbnail: "c300",
          image: "img300",
          yearPublished: 2017,
          numPlays: 0,
        },
      ],
    });
  }

  it("devuelve { items, total, page, pages } fusionando jugados + colección por recencia", async () => {
    await seedAlice();
    const res = await request(app).get("/api/bgg/mis-juegos/alice");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
    expect(res.body.pages).toBe(1);
    expect(res.body.items.map((g) => g.id)).toEqual(["100", "200", "300"]);

    const g100 = res.body.items.find((g) => g.id === "100");
    expect(g100).toMatchObject({
      owned: true,
      numPlays: 2,
      image: "img100",
      year: 1995,
      lastPlayedDate: "2026-03-01",
    });
    expect(res.body.items.find((g) => g.id === "200")).toMatchObject({
      owned: false,
      numPlays: 1,
    });
    expect(res.body.items.find((g) => g.id === "300")).toMatchObject({
      owned: true,
      numPlays: 0,
      lastPlayedDate: null,
    });
  });

  it("pagina con ?limit + ?page sin solapamiento", async () => {
    await seedAlice();
    const p1 = await request(app).get("/api/bgg/mis-juegos/alice?limit=2&page=1");
    expect(p1.body.items.map((g) => g.id)).toEqual(["100", "200"]);
    expect(p1.body.total).toBe(3);
    expect(p1.body.pages).toBe(2);

    const p2 = await request(app).get("/api/bgg/mis-juegos/alice?limit=2&page=2");
    expect(p2.body.items.map((g) => g.id)).toEqual(["300"]);
  });

  it("?q filtra por nombre (accent/case-insensitive)", async () => {
    await seedAlice();
    const res = await request(app).get("/api/bgg/mis-juegos/alice?q=AZ");
    expect(res.body.items.map((g) => g.id)).toEqual(["300"]); // Azul
    expect(res.body.total).toBe(1);
  });

  it("reconstruye lazy y refleja cambios tras invalidar", async () => {
    await createUser({ bggUsername: "bob" });
    await BggPlay.create(
      playDoc({ bggUsername: "bob", playId: "1", gameId: "100", date: "2026-01-01" }),
    );

    const r1 = await request(app).get("/api/bgg/mis-juegos/bob");
    expect(r1.body.total).toBe(1);

    // Nueva partida de otro juego + invalidación (lo que hace el route tras POST).
    await BggPlay.create(
      playDoc({
        bggUsername: "bob",
        playId: "2",
        gameId: "200",
        gameName: "Risk",
        date: "2026-02-01",
      }),
    );
    await User.updateOne(
      { bggUsername: "bob" },
      { $set: { "bggSync.userGamesBuiltAt": null } },
    );

    const r2 = await request(app).get("/api/bgg/mis-juegos/bob");
    expect(r2.body.total).toBe(2);
    expect(r2.body.items.map((g) => g.id)).toContain("200");
  });

  it("NO reconstruye si está fresca (cambios no se reflejan hasta invalidar)", async () => {
    await createUser({ bggUsername: "carl" });
    await BggPlay.create(
      playDoc({ bggUsername: "carl", playId: "1", gameId: "100", date: "2026-01-01" }),
    );
    const r1 = await request(app).get("/api/bgg/mis-juegos/carl");
    expect(r1.body.total).toBe(1);

    // Agregamos un play SIN invalidar → la tabla fresca no se reconstruye.
    await BggPlay.create(
      playDoc({ bggUsername: "carl", playId: "2", gameId: "200", date: "2026-02-01" }),
    );
    const r2 = await request(app).get("/api/bgg/mis-juegos/carl");
    expect(r2.body.total).toBe(1);
  });

  it("colección privada/inexistente → solo jugados", async () => {
    await createUser({ bggUsername: "dana" });
    await BggPlay.create(
      playDoc({ bggUsername: "dana", playId: "1", gameId: "100", date: "2026-01-01" }),
    );
    const res = await request(app).get("/api/bgg/mis-juegos/dana");
    expect(res.body.items.map((g) => g.id)).toEqual(["100"]);
    expect(res.body.items[0].owned).toBe(false);
  });
});
