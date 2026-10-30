const BggPlay = require("../../models/BggPlay");
const BggGame = require("../../models/BggGame");
const BggUserGame = require("../../models/BggUserGame");
const BggGameVariant = require("../../models/BggGameVariant");
const { createUser } = require("../helpers/auth");
const {
  searchGames,
  findPlayers,
  getGameVariants,
  createPlayDraft,
} = require("../../services/bgg/playAgent/toolHandlers");

// Tools del agente de carga de partidas contra datos reales en Mongo. La red
// a BGG se corta (fetch falla) para probar que todo sale de los datos locales.

const ctx = {
  bggUsername: "alice",
  ownerBggUsername: "Alice",
  ownerName: "Alice",
  today: "2026-10-30",
};

function playDoc(overrides) {
  return {
    bggUsername: "alice",
    playId: String(Math.floor(Math.random() * 1e9)),
    gameId: "100",
    gameName: "Root",
    date: "2026-10-01",
    quantity: 1,
    players: [{ name: "Alice", username: "alice" }],
    hash: "x".repeat(40),
    ...overrides,
  };
}

beforeEach(async () => {
  global.fetch = vi.fn(async () => {
    throw new Error("network disabled in tests");
  });
  // userGamesBuiltAt fresco → ensureFreshUserGames no reconstruye.
  await createUser({
    username: "alice",
    bggUsername: "alice",
    bggSync: { userGamesBuiltAt: new Date() },
  });
});

afterEach(() => {
  delete global.fetch;
});

describe("playAgent search_games", () => {
  it("returns the user's own games first, without hitting BGG", async () => {
    await BggUserGame.create([
      { bggUsername: "alice", gameId: "100", name: "Root", searchName: "root", numPlays: 9, lastPlayedDate: "2026-10-01" },
      { bggUsername: "alice", gameId: "200", name: "Root: The Riverfolk Expansion", searchName: "root: the riverfolk expansion", numPlays: 2 },
      { bggUsername: "alice", gameId: "300", name: "Rootbound", searchName: "rootbound", numPlays: 1 },
    ]);
    const out = await searchGames({ query: "Root" }, ctx);
    expect(out.results[0]).toMatchObject({ id: "100", name: "Root", source: "my_games", timesPlayed: 9 });
    expect(out.results).toHaveLength(3);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("reports BGG as unavailable when nothing matches locally", async () => {
    const out = await searchGames({ query: "Gloomhaven" }, ctx);
    expect(out.results).toEqual([]);
    expect(out.note).toMatch(/unavailable/);
  });
});

describe("playAgent find_players", () => {
  it("matches spoken names against co-players and returns the owner", async () => {
    await BggPlay.create(
      playDoc({
        players: [
          { name: "Alice", username: "alice" },
          { name: "Melina Gómez", username: "meli" },
          { name: "Melisa", username: "" },
        ],
      }),
    );
    const out = await findPlayers({ names: ["Meli", "Rocío"] }, ctx);
    expect(out.owner).toEqual({ name: "Alice", username: "Alice" });
    expect(out.matches[0].candidates.map((c) => c.name).sort()).toEqual(["Melina Gómez", "Melisa"]);
    expect(out.matches[1]).toEqual({ spoken: "Rocío", candidates: [] });
  });
});

describe("playAgent get_game_variants", () => {
  it("returns past variants and factions, filtered by query, without team colors", async () => {
    await BggGameVariant.create([
      { bggUsername: "alice", gameId: "100", name: "Mapa de invierno" },
      { bggUsername: "alice", gameId: "100", name: "Mapa de otoño" },
    ]);
    await BggPlay.create(
      playDoc({
        players: [
          { name: "Alice", username: "alice", color: "Marquesa" },
          { name: "Bob", username: "bob", color: "Águilas" },
        ],
      }),
    );
    await BggPlay.create(
      playDoc({ players: [{ name: "Alice", username: "alice", color: "Equipo A" }] }),
    );

    const all = await getGameVariants({ gameId: "100" }, ctx);
    expect(all.variants).toEqual(expect.arrayContaining(["Mapa de invierno", "Mapa de otoño"]));
    expect(all.factions.sort()).toEqual(["Marquesa", "Águilas"].sort());
    expect(all.expansions).toEqual([]); // BGG caído → sin expansiones, sin romper

    const winter = await getGameVariants({ gameId: "100", query: "invierno" }, ctx);
    expect(winter.variants).toEqual(["Mapa de invierno"]);
    expect(winter.factions).toEqual([]);
  });

  it("rejects a non-numeric gameId", async () => {
    expect(await getGameVariants({ gameId: "root" }, ctx)).toHaveProperty("error");
  });
});

describe("playAgent create_play_draft", () => {
  const input = {
    gameId: "100",
    gameName: "Root",
    playdate: "2026-10-29",
    mode: "versus",
    players: [
      { name: "Alice", username: "alice", score: 30, win: true, faction: "Marquesa" },
      { name: "Bob", username: "bob", score: 22, faction: "Águilas" },
    ],
  };

  it("validates against the cached game and fills its data", async () => {
    await BggGame.create({ gameId: 100, name: "Root", minPlayers: 2, maxPlayers: 4, thumbnail: "t.jpg" });
    const out = await createPlayDraft(input, ctx);
    expect(out.ok).toBe(true);
    expect(out.warnings).toEqual([]);
    expect(out.draft.game).toMatchObject({ id: "100", name: "Root", thumbnail: "t.jpg" });
    expect(out.draft.players[0]).toMatchObject({ faction: "Marquesa", win: true });
  });

  it("warns about a play of the same game on the same date", async () => {
    await BggGame.create({ gameId: 100, name: "Root", minPlayers: 2, maxPlayers: 4 });
    await BggPlay.create(playDoc({ date: "2026-10-29" }));
    const out = await createPlayDraft(input, ctx);
    expect(out.ok).toBe(true);
    expect(out.warnings.join(" ")).toMatch(/duplicate/);
  });

  it("returns errors without throwing when the input is invalid", async () => {
    const out = await createPlayDraft({ ...input, playdate: "2027-01-01" }, ctx);
    expect(out.ok).toBe(false);
    expect(out.errors.join(" ")).toMatch(/future/);
  });
});
