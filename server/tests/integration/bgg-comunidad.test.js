const request = require("supertest");
const app = require("../../app");
const BggPlay = require("../../models/BggPlay");
const BggGame = require("../../models/BggGame");
const BggCollection = require("../../models/BggCollection");
const Community = require("../../models/Community");
const { createUser, tokenFor, authHeader } = require("../helpers/auth");
const { _resetForTests } = require("../../services/bgg/bggCache");

// Las rutas /comunidad/* enriquecen juegos vía resolveGame(sBatch). Seedeamos
// BggGame para los ids usados (resuelve desde Mongo, sin red) y reseteamos la
// L1 cache entre tests para que el enriquecido sea determinístico.
beforeEach(async () => {
  _resetForTests();
  await BggGame.insertMany(
    [100, 200, 300].map((id) => ({
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

describe("GET /api/bgg/comunidad/juegos", () => {
  it("rankea juegos de la comunidad", async () => {
    await BggPlay.create(play({ gameId: "100", quantity: 3 }));
    await BggPlay.create(play({ bggUsername: "bob", gameId: "100" }));
    await BggPlay.create(play({ gameId: "200" }));

    const res = await request(app).get("/api/bgg/comunidad/juegos");
    expect(res.status).toBe(200);
    expect(res.body.periodo).toBe("all");
    expect(res.body.games[0].id).toBe("100");
    expect(res.body.games[0].totalPlays).toBe(4);
    expect(res.body.games[0].playerCount).toBe(2);
    expect(res.body.games[0].image).toBe("image-100");
  });

  it("periodo=mes filtra a los últimos 30 días", async () => {
    await BggPlay.create(play({ gameId: "100", date: "2020-01-01" }));
    await BggPlay.create(play({ gameId: "200", date: "2026-06-04" }));
    const res = await request(app).get("/api/bgg/comunidad/juegos?periodo=mes");
    expect(res.body.periodo).toBe("mes");
    expect(res.body.games.map((g) => g.id)).toEqual(["200"]);
  });
});

describe("GET /api/bgg/comunidad/juego/:gameId", () => {
  it("devuelve stats + dueños miembros", async () => {
    await createUser({ bggUsername: "alice", displayName: "Alicia" });
    await BggPlay.create(play({ gameId: "100" }));
    await BggCollection.create({
      bggUsername: "alice",
      games: [{ id: "100", name: "Catan" }],
    });

    const res = await request(app).get("/api/bgg/comunidad/juego/100");
    expect(res.status).toBe(200);
    expect(res.body.game.id).toBe(100);
    expect(res.body.stats.totalPlays).toBe(1);
    expect(res.body.owners[0].user.displayName).toBe("Alicia");
  });

  it("400 con gameId inválido", async () => {
    const res = await request(app).get("/api/bgg/comunidad/juego/abc");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/bgg/comunidad/jugadores", () => {
  it("metric=plays rankea por partidas", async () => {
    await BggPlay.create(play({ bggUsername: "alice", quantity: 3 }));
    await BggPlay.create(play({ bggUsername: "bob", quantity: 1 }));
    const res = await request(app).get(
      "/api/bgg/comunidad/jugadores?metric=plays",
    );
    expect(res.body.players[0].bggUsername).toBe("alice");
    expect(res.body.players[0].totalPlays).toBe(3);
  });

  it("metric=winrate aplica umbral mínimo", async () => {
    for (let i = 0; i < 5; i += 1) {
      await BggPlay.create(
        play({
          bggUsername: "alice",
          players: [{ username: "alice", win: true }],
        }),
      );
    }
    await BggPlay.create(
      play({ bggUsername: "bob", players: [{ username: "bob", win: true }] }),
    );
    const res = await request(app).get(
      "/api/bgg/comunidad/jugadores?metric=winrate",
    );
    expect(res.body.players.map((p) => p.bggUsername)).toEqual(["alice"]);
    expect(res.body.players[0].winRate).toBe(1);
  });
});

describe("GET /api/bgg/comunidad/h2h/:a/:b", () => {
  it("talla el head-to-head", async () => {
    await createUser({ bggUsername: "alice", displayName: "Alicia" });
    await createUser({ bggUsername: "bob", displayName: "Bobby" });
    await BggPlay.create(
      play({
        bggUsername: "alice",
        players: [
          { username: "alice", win: true },
          { username: "bob", win: false },
        ],
      }),
    );
    const res = await request(app).get("/api/bgg/comunidad/h2h/alice/bob");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.aWins).toBe(1);
    expect(res.body.userB.user.displayName).toBe("Bobby");
  });

  it("400 si son el mismo usuario", async () => {
    const res = await request(app).get("/api/bgg/comunidad/h2h/alice/Alice");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/bgg/comunidad/actividad", () => {
  it("devuelve feed paginado por fecha desc", async () => {
    await BggPlay.create(play({ date: "2026-06-01" }));
    await BggPlay.create(play({ date: "2026-06-03" }));
    const res = await request(app).get("/api/bgg/comunidad/actividad?limit=10");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items[0].date).toBe("2026-06-03");
  });
});

describe("GET /api/bgg/comunidad/heatmap", () => {
  it("cuenta partidas por día del último año", async () => {
    await BggPlay.create(play({ date: "2026-06-01" }));
    await BggPlay.create(play({ date: "2026-06-01" }));
    const res = await request(app).get("/api/bgg/comunidad/heatmap");
    expect(res.status).toBe(200);
    const day = res.body.heatmap.find((d) => d.date === "2026-06-01");
    expect(day.count).toBe(2);
  });
});

describe("scoping por comunidad (fase 2)", () => {
  // Miembro de Beta (BGG conectado) que eligió ver solo Beta + un forastero
  // global. Las stats del miembro deben acotarse a Beta; el anónimo (que ve la
  // base) las ve todas.
  async function setupBetaViewerAndOutsider() {
    const beta = await Community.create({ name: "Beta", slug: "beta" });
    const viewer = await createUser({
      bggUsername: "alice",
      communityMemberships: [{ community: beta._id, role: "member" }],
      communityPrefs: { viewing: [beta._id], skin: beta._id },
    });
    await createUser({ bggUsername: "bob" }); // solo base
    return { beta, viewer };
  }

  it("un miembro viendo su comunidad solo ve juegos de esa comunidad", async () => {
    const { viewer } = await setupBetaViewerAndOutsider();
    await BggPlay.create(play({ bggUsername: "alice", gameId: "100" }));
    await BggPlay.create(play({ bggUsername: "bob", gameId: "200" }));

    const res = await request(app)
      .get("/api/bgg/comunidad/juegos")
      .set(authHeader(tokenFor(viewer)));
    expect(res.status).toBe(200);
    expect(res.body.games.map((g) => g.id)).toEqual(["100"]);
  });

  it("anónimo (viendo la base) ve el ranking global", async () => {
    await setupBetaViewerAndOutsider();
    await BggPlay.create(play({ bggUsername: "alice", gameId: "100" }));
    await BggPlay.create(play({ bggUsername: "bob", gameId: "200" }));

    const res = await request(app).get("/api/bgg/comunidad/juegos");
    expect(res.body.games.map((g) => g.id).sort()).toEqual(["100", "200"]);
  });

  it("el leaderboard de jugadores se acota a los miembros de la comunidad", async () => {
    const { viewer } = await setupBetaViewerAndOutsider();
    await BggPlay.create(play({ bggUsername: "alice", quantity: 3 }));
    await BggPlay.create(play({ bggUsername: "bob", quantity: 5 }));

    const res = await request(app)
      .get("/api/bgg/comunidad/jugadores?metric=plays")
      .set(authHeader(tokenFor(viewer)));
    expect(res.body.players.map((p) => p.bggUsername)).toEqual(["alice"]);
  });

  it("la actividad se acota a los miembros de la comunidad", async () => {
    const { viewer } = await setupBetaViewerAndOutsider();
    await BggPlay.create(play({ bggUsername: "alice", date: "2026-06-02" }));
    await BggPlay.create(play({ bggUsername: "bob", date: "2026-06-03" }));

    const res = await request(app)
      .get("/api/bgg/comunidad/actividad")
      .set(authHeader(tokenFor(viewer)));
    expect(res.body.total).toBe(1);
    expect(res.body.items.map((i) => i.bggUsername)).toEqual(["alice"]);
  });
});

describe("GET /api/bgg/comunidad/rank/:bggUsername/:gameId", () => {
  it("devuelve el rank del usuario en ese juego", async () => {
    await BggPlay.create(
      play({ bggUsername: "alice", gameId: "100", quantity: 5 }),
    );
    await BggPlay.create(
      play({ bggUsername: "bob", gameId: "100", quantity: 2 }),
    );
    const res = await request(app).get("/api/bgg/comunidad/rank/bob/100");
    expect(res.status).toBe(200);
    expect(res.body.rank).toEqual({ rank: 2, total: 2, numPlays: 2 });
  });

  it("rank null si el usuario no jugó ese juego", async () => {
    const res = await request(app).get("/api/bgg/comunidad/rank/ghost/100");
    expect(res.body.rank).toBeNull();
  });

  it("400 con gameId inválido", async () => {
    const res = await request(app).get("/api/bgg/comunidad/rank/alice/abc");
    expect(res.status).toBe(400);
  });
});
