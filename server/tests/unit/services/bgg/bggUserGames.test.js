const BggPlay = require("../../../../models/BggPlay");
const BggCollection = require("../../../../models/BggCollection");
const BggUserGame = require("../../../../models/BggUserGame");
const User = require("../../../../models/User");
const {
  USER_GAMES_TTL_MS,
  normalizeForSearch,
  rebuildUserGames,
  ensureFreshUserGames,
  markUserGamesDirty,
  wipeUserGames,
} = require("../../../../services/bgg/bggUserGames");
const bggCache = require("../../../../services/bgg/bggCache");
const { createUser } = require("../../../helpers/auth");

async function play(overrides = {}) {
  return BggPlay.create({
    bggUsername: "alice",
    playId: String(Math.floor(Math.random() * 1e9)),
    gameId: "100",
    gameName: "Catan",
    date: "2026-01-01",
    quantity: 1,
    players: [],
    hash: "x".repeat(40),
    ...overrides,
  });
}

async function seedCollection(bggUsername, games) {
  return BggCollection.create({
    bggUsername,
    lastFetchedAt: new Date(), // fresco → resolveCollection sirve de L2 sin fetch
    games,
  });
}

beforeEach(() => {
  bggCache._resetForTests();
  // Red de seguridad: cualquier fetch de colección no-seedeada falla rápido
  // (→ rebuild cae a "solo jugados") en vez de pegarle a BGG real.
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

describe("normalizeForSearch", () => {
  it("quita acentos y baja a minúsculas", () => {
    expect(normalizeForSearch("Catán")).toBe("catan");
    expect(normalizeForSearch("  ZÉLDA ")).toBe("zelda");
    expect(normalizeForSearch(null)).toBe("");
  });
});

describe("rebuildUserGames", () => {
  it("construye filas desde jugados + colección, con owned/image/year/searchName", async () => {
    await createUser({ bggUsername: "alice" });
    await play({ gameId: "100", date: "2026-02-01" });
    await play({ gameId: "100", date: "2026-03-01" });
    await play({ gameId: "200", gameName: "Risk", date: "2026-01-01" });
    await seedCollection("alice", [
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
    ]);

    const count = await rebuildUserGames("alice");
    expect(count).toBe(3);

    const rows = await BggUserGame.find({ bggUsername: "alice" }).lean();
    expect(rows).toHaveLength(3);
    const byId = Object.fromEntries(rows.map((r) => [r.gameId, r]));
    expect(byId["100"]).toMatchObject({
      owned: true,
      numPlays: 2,
      image: "img100",
      year: 1995,
      lastPlayedDate: "2026-03-01",
      searchName: "catan",
    });
    expect(byId["200"]).toMatchObject({ owned: false, numPlays: 1 });
    expect(byId["300"]).toMatchObject({
      owned: true,
      numPlays: 0,
      lastPlayedDate: null,
    });

    const u = await User.findOne({ bggUsername: "alice" }).lean();
    expect(u.bggSync.userGamesBuiltAt).toBeInstanceOf(Date);
  });

  it("reconcilia: borra filas que ya no están en las fuentes", async () => {
    await createUser({ bggUsername: "alice" });
    await play({ gameId: "100", date: "2026-01-01" });
    // Fila vieja que ya no corresponde a ningún play/colección.
    await BggUserGame.create({
      bggUsername: "alice",
      gameId: "999",
      name: "Fantasma",
      searchName: "fantasma",
    });

    await rebuildUserGames("alice");

    const ids = (await BggUserGame.find({ bggUsername: "alice" }).lean()).map(
      (r) => r.gameId,
    );
    expect(ids).toEqual(["100"]);
  });

  it("es idempotente (no duplica)", async () => {
    await createUser({ bggUsername: "alice" });
    await play({ gameId: "100", date: "2026-01-01" });
    await rebuildUserGames("alice");
    await rebuildUserGames("alice");
    expect(await BggUserGame.countDocuments({ bggUsername: "alice" })).toBe(1);
  });
});

describe("ensureFreshUserGames", () => {
  it("reconstruye si nunca se construyó (builtAt null)", async () => {
    await createUser({ bggUsername: "alice" });
    await play({ gameId: "100", date: "2026-01-01" });
    await ensureFreshUserGames("alice");
    expect(await BggUserGame.countDocuments({ bggUsername: "alice" })).toBe(1);
  });

  it("reconstruye si está vieja (builtAt > TTL)", async () => {
    await createUser({
      bggUsername: "alice",
      bggSync: { userGamesBuiltAt: new Date(Date.now() - USER_GAMES_TTL_MS - 1000) },
    });
    await play({ gameId: "100", date: "2026-01-01" });
    await ensureFreshUserGames("alice");
    expect(await BggUserGame.countDocuments({ bggUsername: "alice" })).toBe(1);
  });

  it("NO reconstruye si está fresca (cambios en fuentes no se reflejan)", async () => {
    await createUser({
      bggUsername: "alice",
      bggSync: { userGamesBuiltAt: new Date() },
    });
    // Hay un play nuevo pero la tabla está fresca y vacía → no debe reconstruir.
    await play({ gameId: "100", date: "2026-01-01" });
    await ensureFreshUserGames("alice");
    expect(await BggUserGame.countDocuments({ bggUsername: "alice" })).toBe(0);
  });
});

describe("markUserGamesDirty", () => {
  it("pone userGamesBuiltAt en null (case-insensitive)", async () => {
    await createUser({
      bggUsername: "ClaudioH",
      bggSync: { userGamesBuiltAt: new Date() },
    });
    await markUserGamesDirty("claudioh");
    const u = await User.findOne({ bggUsername: "ClaudioH" }).lean();
    expect(u.bggSync.userGamesBuiltAt).toBeNull();
  });
});

describe("wipeUserGames", () => {
  it("borra las filas del usuario y marca sucia", async () => {
    await createUser({
      bggUsername: "alice",
      bggSync: { userGamesBuiltAt: new Date() },
    });
    await BggUserGame.create({
      bggUsername: "alice",
      gameId: "100",
      name: "Catan",
      searchName: "catan",
    });
    await wipeUserGames("alice");
    expect(await BggUserGame.countDocuments({ bggUsername: "alice" })).toBe(0);
    const u = await User.findOne({ bggUsername: "alice" }).lean();
    expect(u.bggSync.userGamesBuiltAt).toBeNull();
  });
});
