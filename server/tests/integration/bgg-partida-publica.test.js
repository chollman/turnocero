const request = require("supertest");
const app = require("../../app");
const BggPlay = require("../../models/BggPlay");
const BggGame = require("../../models/BggGame");
const BggPlayerOverlay = require("../../models/BggPlayerOverlay");
const { createUser } = require("../helpers/auth");

// Endpoints PÚBLICOS del detalle de partida (página /bg-watch/:user/partidas/:playId):
//   GET /api/bgg/partida/:bggUsername/:playId/detalle  — play + game (imagen grande)
//   GET /api/bgg/partida/:bggUsername/:playId/og       — metadata para previews
//   GET /api/bgg/partida/:bggUsername/:playId/grupo    — partidas con el mismo grupo

function playDoc(overrides) {
  return {
    bggUsername: "alice",
    playId: "1001",
    gameId: "9100",
    gameName: "Catan",
    gameThumbnail: "https://cf.geekdo/thumb9100.jpg",
    date: "2026-03-01",
    duration: 60,
    location: "Casa",
    quantity: 1,
    comments: "buena",
    incomplete: false,
    nowinstats: false,
    players: [
      { name: "Alice", username: "alice", win: true, score: "10" },
      { name: "Bob", username: "bob", win: false, score: "7" },
    ],
    hash: "x".repeat(40),
    ...overrides,
  };
}

async function seedGame(overrides = {}) {
  return BggGame.create({
    gameId: 9100,
    name: "Catan",
    image: "https://cf.geekdo/image9100.jpg",
    thumbnail: "https://cf.geekdo/thumb9100.jpg",
    yearPublished: 1995,
    playingTime: 60,
    ...overrides,
  });
}

describe("GET /api/bgg/partida/:bggUsername/:playId/detalle", () => {
  it("es público y devuelve play + game (imagen grande)", async () => {
    await BggPlay.create(playDoc());
    await seedGame();
    const res = await request(app).get("/api/bgg/partida/alice/1001/detalle");
    expect(res.status).toBe(200);
    expect(res.body.play).toMatchObject({
      id: "1001",
      gameName: "Catan",
      date: "2026-03-01",
      location: "Casa",
      duration: 60,
    });
    expect(res.body.play.players).toHaveLength(2);
    expect(res.body.game).toMatchObject({
      id: 9100,
      image: "https://cf.geekdo/image9100.jpg",
    });
  });

  it("aplica el overlay de curación a los players", async () => {
    await BggPlay.create(playDoc());
    await seedGame();
    await BggPlayerOverlay.create({
      ownerUsername: "alice",
      rawKeys: ["u:bob"],
      nameOverride: "Roberto",
    });
    const res = await request(app).get("/api/bgg/partida/alice/1001/detalle");
    expect(res.status).toBe(200);
    const bob = res.body.play.players.find((p) => p.username === "bob");
    expect(bob.name).toBe("Roberto");
  });

  it("404 si la partida no existe (con fallback BGG vacío)", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        `<?xml version="1.0"?><plays username="alice" total="0" page="1"></plays>`,
    }));
    const res = await request(app).get("/api/bgg/partida/alice/9999/detalle");
    expect(res.status).toBe(404);
    delete global.fetch;
  });
});

describe("GET /api/bgg/partida/:bggUsername/:playId/og", () => {
  it("devuelve metadata con la imagen del juego (image > thumbnail)", async () => {
    await BggPlay.create(playDoc({ playId: "2001" }));
    await seedGame();
    const user = await createUser({ bggUsername: "Alice" });
    const res = await request(app).get("/api/bgg/partida/alice/2001/og");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      gameName: "Catan",
      image: "https://cf.geekdo/image9100.jpg",
      date: "2026-03-01",
      location: "Casa",
      duration: 60,
      playersCount: 2,
      bggUsername: "alice",
    });
    expect(res.body.playerNames).toEqual(["Alice", "Bob"]);
    expect(res.body.displayName).toBe(user.displayName || user.username);
  });

  it("404 con body vacío si la partida no está espejada (contrato de crawlers)", async () => {
    const res = await request(app).get("/api/bgg/partida/alice/40404/og");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({});
  });

  it("sin BggGame cae al gameThumbnail de la play", async () => {
    await BggPlay.create(
      playDoc({ playId: "2002", gameId: "9999991", gameThumbnail: "thumb-x" }),
    );
    // resolveGame va a intentar BGG → mockeamos thing vacío.
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "<items></items>",
    }));
    const res = await request(app).get("/api/bgg/partida/alice/2002/og");
    expect(res.status).toBe(200);
    expect(res.body.image).toBe("thumb-x");
    delete global.fetch;
  });
});

describe("GET /api/bgg/partida/:bggUsername/:playId/grupo", () => {
  it("es público, matchea roster exacto y devuelve stats + plays paginadas", async () => {
    await BggPlay.create(playDoc({ playId: "3001", date: "2026-03-01" }));
    // Mismo grupo, otro juego.
    await BggPlay.create(
      playDoc({
        playId: "3002",
        date: "2026-03-05",
        gameId: "9200",
        gameName: "Wingspan",
        players: [
          { name: "Bob", username: "bob", win: true },
          { name: "Alice", username: "alice", win: false },
        ],
      }),
    );
    // Grupo distinto (uno más) — no matchea.
    await BggPlay.create(
      playDoc({
        playId: "3003",
        date: "2026-03-06",
        players: [
          { username: "alice", win: true },
          { username: "bob" },
          { name: "Caro" },
        ],
      }),
    );

    const res = await request(app).get("/api/bgg/partida/alice/3001/grupo");
    expect(res.status).toBe(200);
    expect(res.body.stats.total).toBe(2);
    expect(res.body.total).toBe(2);
    expect(res.body.plays.map((p) => p.id)).toEqual(["3002", "3001"]);
    // Victorias por integrante: 1 y 1.
    const wins = Object.fromEntries(
      res.body.roster.map((r) => [r.username, r.wins]),
    );
    expect(wins).toEqual({ alice: 1, bob: 1 });
    expect(res.body.stats.byGame).toHaveLength(2);
  });

  it("aplica el overlay al roster (nombres curados)", async () => {
    await BggPlay.create(playDoc({ playId: "3101" }));
    await BggPlayerOverlay.create({
      ownerUsername: "alice",
      rawKeys: ["u:bob"],
      nameOverride: "Roberto",
    });
    const res = await request(app).get("/api/bgg/partida/alice/3101/grupo");
    expect(res.status).toBe(200);
    const bob = res.body.roster.find((r) => r.username === "bob");
    expect(bob.name).toBe("Roberto");
  });

  it("404 si la partida no existe", async () => {
    const res = await request(app).get("/api/bgg/partida/alice/nope/grupo");
    expect(res.status).toBe(404);
  });
});
