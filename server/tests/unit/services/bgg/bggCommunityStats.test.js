const BggPlay = require("../../../../models/BggPlay");
const BggCollection = require("../../../../models/BggCollection");
const BggGame = require("../../../../models/BggGame");
const BggPlayerOverlay = require("../../../../models/BggPlayerOverlay");
const Community = require("../../../../models/Community");
const { createUser } = require("../../../helpers/auth");
const { _resetForTests } = require("../../../../services/bgg/bggCache");
const {
  resolveBggUsernamesToUsers,
  connectedMemberUsernames,
  communityMemberUsernames,
  topCommunityGames,
  gameCommunityStats,
  gameOwners,
  communityPlayerLeaderboard,
  communityWinRates,
  longestWeekStreak,
  communityStreaks,
  topCoPlayers,
  headToHead,
  communityActivityFeed,
  communityActivityHeatmap,
  playerGameRank,
} = require("../../../../services/bgg/bggCommunityStats");

// Seed de BggGame para los ids usados, así resolveGamesBatch (en
// topCommunityGames) resuelve desde Mongo sin tocar la red de BGG. La L1
// cache se resetea entre tests para que el enriquecido sea determinístico.
beforeEach(async () => {
  _resetForTests();
  await BggGame.insertMany(
    [100, 200, 300, 999].map((id) => ({
      gameId: id,
      name: `Game ${id}`,
      thumbnail: `thumb-${id}`,
      image: `image-${id}`,
    })),
  );
});

let playSeq = 0;
async function makePlay(overrides = {}) {
  playSeq += 1;
  return BggPlay.create({
    bggUsername: "alice",
    playId: `p${playSeq}`,
    gameId: "100",
    gameName: "Catan",
    date: "2026-01-01",
    quantity: 1,
    duration: 60,
    players: [{ username: "alice", win: true, score: "10" }],
    hash: String(playSeq).padStart(40, "0"),
    ...overrides,
  });
}

describe("resolveBggUsernamesToUsers", () => {
  it("devuelve un Map vacío sin input", async () => {
    const map = await resolveBggUsernamesToUsers([]);
    expect(map.size).toBe(0);
  });

  it("mapea username lowercase → user con avatar", async () => {
    const u = await createUser({
      bggUsername: "alice",
      displayName: "Alicia",
      avatar: { url: "u", publicId: "p", color: "--green" },
    });
    const map = await resolveBggUsernamesToUsers(["alice", "ghost"]);
    expect(map.size).toBe(1);
    const entry = map.get("alice");
    expect(entry._id.toString()).toBe(u._id.toString());
    expect(entry.displayName).toBe("Alicia");
    expect(entry.avatar.url).toBe("u");
  });

  // REGRESIÓN case-mismatch (memory: feedback-bgg-username-case): el User
  // guarda bggUsername case-preserved, la lista viene lowercase → debe
  // matchear igual via collation strength 2.
  it("matchea un bggUsername mixed-case con la key lowercase", async () => {
    await createUser({ bggUsername: "MixedCase", displayName: "Mix" });
    const map = await resolveBggUsernamesToUsers(["mixedcase"]);
    expect(map.has("mixedcase")).toBe(true);
    expect(map.get("mixedcase").displayName).toBe("Mix");
  });
});

describe("connectedMemberUsernames", () => {
  it("devuelve los bggUsername conectados en lowercase, sin vacíos", async () => {
    await createUser({ bggUsername: "Alice" });
    await createUser({ bggUsername: "BOB" });
    await createUser({ bggUsername: "" }); // sin conectar
    const set = await connectedMemberUsernames();
    expect(set.sort()).toEqual(["alice", "bob"]);
  });
});

describe("communityMemberUsernames", () => {
  it("devuelve null sin comunidades en el scope", async () => {
    expect(await communityMemberUsernames([])).toBeNull();
    expect(await communityMemberUsernames(null)).toBeNull();
  });

  it("devuelve null si el scope incluye la base (= global)", async () => {
    const base = await Community.getBase();
    const beta = await Community.create({ name: "Beta", slug: "beta" });
    expect(await communityMemberUsernames([base._id])).toBeNull();
    expect(await communityMemberUsernames([base._id, beta._id])).toBeNull();
  });

  it("resuelve los bggUsernames (lowercase) de miembros conectados de la comunidad", async () => {
    const beta = await Community.create({ name: "Beta", slug: "beta" });
    const gamma = await Community.create({ name: "Gamma", slug: "gamma" });
    await createUser({
      bggUsername: "Alice", // case-preserved en User → lowercase en el output
      communityMemberships: [{ community: beta._id, role: "member" }],
    });
    await createUser({
      bggUsername: "BOB",
      communityMemberships: [{ community: beta._id, role: "member" }],
    });
    await createUser({
      bggUsername: "", // miembro de beta pero sin BGG → excluido
      communityMemberships: [{ community: beta._id, role: "member" }],
    });
    await createUser({
      bggUsername: "carol", // miembro de otra comunidad → excluido
      communityMemberships: [{ community: gamma._id, role: "member" }],
    });

    const result = await communityMemberUsernames([beta._id]);
    expect(result.sort()).toEqual(["alice", "bob"]);
  });

  it("devuelve [] (no global) para una comunidad real sin miembros conectados", async () => {
    const empty = await Community.create({ name: "Empty", slug: "empty" });
    expect(await communityMemberUsernames([empty._id])).toEqual([]);
  });
});

describe("topCommunityGames", () => {
  it("rankea por totalPlays y cuenta miembros distintos", async () => {
    // Juego 100: alice 2 plays (qty 1 + 2 = 3) + bob 1 → 4 plays, 2 miembros.
    await makePlay({ bggUsername: "alice", gameId: "100", quantity: 1 });
    await makePlay({ bggUsername: "alice", gameId: "100", quantity: 2 });
    await makePlay({ bggUsername: "bob", gameId: "100", quantity: 1 });
    // Juego 200: alice 1 play → menos jugado.
    await makePlay({ bggUsername: "alice", gameId: "200", quantity: 1 });

    const top = await topCommunityGames({ limit: 10 });
    expect(top).toHaveLength(2);
    expect(top[0].id).toBe("100");
    expect(top[0].totalPlays).toBe(4);
    expect(top[0].playerCount).toBe(2);
    expect(top[0].image).toBe("image-100"); // enriquecido vía resolveGamesBatch
    expect(top[1].id).toBe("200");
    expect(top[1].playerCount).toBe(1);
  });

  it("filtra por sinceDate (en llamas)", async () => {
    await makePlay({ gameId: "100", date: "2026-01-01" });
    await makePlay({ gameId: "300", date: "2026-06-01" });
    const recent = await topCommunityGames({ sinceDate: "2026-05-01" });
    expect(recent.map((g) => g.id)).toEqual(["300"]);
  });

  it("respeta la allowlist bggUsernames", async () => {
    await makePlay({ bggUsername: "alice", gameId: "100" });
    await makePlay({ bggUsername: "bob", gameId: "200" });
    const scoped = await topCommunityGames({ bggUsernames: ["alice"] });
    expect(scoped.map((g) => g.id)).toEqual(["100"]);
  });

  it("respeta el limit", async () => {
    await makePlay({ gameId: "100" });
    await makePlay({ gameId: "200" });
    await makePlay({ gameId: "300" });
    const top = await topCommunityGames({ limit: 2 });
    expect(top).toHaveLength(2);
  });
});

describe("gameCommunityStats", () => {
  it("computa totales, win-rate, duración y score promedio", async () => {
    await createUser({ bggUsername: "alice", displayName: "Alicia" });
    // alice gana 1, pierde 1 → winRate 0.5 sobre 2 decididas.
    await makePlay({
      bggUsername: "alice",
      gameId: "100",
      duration: 60,
      players: [
        { username: "alice", win: true, score: "10" },
        { username: "bob", win: false, score: "6" },
      ],
    });
    await makePlay({
      bggUsername: "alice",
      gameId: "100",
      duration: 80,
      players: [
        { username: "alice", win: false, score: "4" },
        { username: "bob", win: true, score: "12" },
      ],
    });
    const stats = await gameCommunityStats("100");
    expect(stats.totalPlays).toBe(2);
    expect(stats.memberCount).toBe(1);
    expect(stats.wins).toBe(1);
    expect(stats.decided).toBe(2);
    expect(stats.winRate).toBe(0.5);
    expect(stats.avgDuration).toBe(70);
    expect(stats.avgScore).toBe(8); // (10+6+4+12)/4
    expect(stats.maxScore).toBe(12);
    expect(stats.topPlayers[0].bggUsername).toBe("alice");
    expect(stats.topPlayers[0].numPlays).toBe(2);
    expect(stats.topPlayers[0].user.displayName).toBe("Alicia");
  });

  it("winRate null y score null cuando no hay datos numéricos", async () => {
    await makePlay({
      gameId: "999",
      duration: null,
      players: [{ username: "ghost", win: false, score: "abc" }],
    });
    const stats = await gameCommunityStats("999");
    expect(stats.totalPlays).toBe(1);
    expect(stats.winRate).toBeNull(); // owner (alice) no está en players
    expect(stats.avgScore).toBeNull(); // "abc" no es numérico
    expect(stats.avgDuration).toBeNull();
  });
});

describe("gameOwners", () => {
  it("lista miembros que poseen el juego, resueltos a User", async () => {
    await createUser({ bggUsername: "alice", displayName: "Alicia" });
    await BggCollection.create({
      bggUsername: "alice",
      games: [{ id: "100", name: "Catan" }],
    });
    await BggCollection.create({
      bggUsername: "bob",
      games: [{ id: "200", name: "Otro" }],
    });
    const owners = await gameOwners("100");
    expect(owners).toHaveLength(1);
    expect(owners[0].bggUsername).toBe("alice");
    expect(owners[0].user.displayName).toBe("Alicia");
  });

  it("respeta la allowlist bggUsernames", async () => {
    await BggCollection.create({
      bggUsername: "alice",
      games: [{ id: "100" }],
    });
    await BggCollection.create({
      bggUsername: "carol",
      games: [{ id: "100" }],
    });
    const owners = await gameOwners("100", { bggUsernames: ["alice"] });
    expect(owners.map((o) => o.bggUsername)).toEqual(["alice"]);
  });
});

describe("communityPlayerLeaderboard", () => {
  it("rankea por plays y por variedad", async () => {
    // alice: 3 plays, 1 juego. bob: 2 plays, 2 juegos.
    await makePlay({ bggUsername: "alice", gameId: "100", quantity: 3 });
    await makePlay({ bggUsername: "bob", gameId: "100", quantity: 1 });
    await makePlay({ bggUsername: "bob", gameId: "200", quantity: 1 });

    const byPlays = await communityPlayerLeaderboard({ metric: "plays" });
    expect(byPlays[0].bggUsername).toBe("alice");
    expect(byPlays[0].totalPlays).toBe(3);

    const byVariety = await communityPlayerLeaderboard({ metric: "variedad" });
    expect(byVariety[0].bggUsername).toBe("bob");
    expect(byVariety[0].uniqueGames).toBe(2);
  });

  it("filtra por sinceDate (jugador del mes)", async () => {
    await makePlay({ bggUsername: "alice", date: "2026-01-01" });
    await makePlay({ bggUsername: "bob", date: "2026-06-02" });
    const month = await communityPlayerLeaderboard({ sinceDate: "2026-06-01" });
    expect(month.map((r) => r.bggUsername)).toEqual(["bob"]);
  });
});

describe("communityWinRates", () => {
  it("computa win-rate por miembro respetando minPlays", async () => {
    // alice: 2 wins de 3 decididas. bob: 1 sola partida (< minPlays).
    await makePlay({
      bggUsername: "alice",
      players: [{ username: "alice", win: true }],
    });
    await makePlay({
      bggUsername: "alice",
      players: [{ username: "alice", win: true }],
    });
    await makePlay({
      bggUsername: "alice",
      players: [{ username: "alice", win: false }],
    });
    await makePlay({
      bggUsername: "bob",
      players: [{ username: "bob", win: true }],
    });

    const rates = await communityWinRates({ minPlays: 3 });
    expect(rates).toHaveLength(1);
    expect(rates[0].bggUsername).toBe("alice");
    expect(rates[0].wins).toBe(2);
    expect(rates[0].decided).toBe(3);
    expect(rates[0].winRate).toBeCloseTo(2 / 3);
  });
});

describe("longestWeekStreak (pura)", () => {
  it("cuenta semanas consecutivas", () => {
    // 3 lunes seguidos → racha 3.
    expect(longestWeekStreak(["2026-01-05", "2026-01-12", "2026-01-19"])).toBe(
      3,
    );
  });
  it("rompe la racha con un hueco", () => {
    expect(longestWeekStreak(["2026-01-05", "2026-01-19"])).toBe(1);
  });
  it("varias fechas en la misma semana cuentan una sola vez", () => {
    expect(longestWeekStreak(["2026-01-05", "2026-01-07", "2026-01-12"])).toBe(
      2,
    );
  });
  it("devuelve 0 sin fechas", () => {
    expect(longestWeekStreak([])).toBe(0);
  });
});

describe("communityStreaks", () => {
  it("rankea por racha semanal", async () => {
    await makePlay({ bggUsername: "alice", date: "2026-01-05" });
    await makePlay({ bggUsername: "alice", date: "2026-01-12" });
    await makePlay({ bggUsername: "bob", date: "2026-01-05" });
    const streaks = await communityStreaks();
    expect(streaks[0].bggUsername).toBe("alice");
    expect(streaks[0].weekStreak).toBe(2);
  });
});

describe("topCoPlayers", () => {
  it("lista compañeros por cantidad de partidas y resuelve miembros", async () => {
    await createUser({ bggUsername: "bob", displayName: "Bobby" });
    await makePlay({
      bggUsername: "alice",
      players: [
        { username: "alice", win: true },
        { username: "bob", win: false },
      ],
    });
    await makePlay({
      bggUsername: "alice",
      players: [
        { username: "alice", win: true },
        { username: "bob", win: false },
        { name: "Invitado" },
      ],
    });
    const co = await topCoPlayers("alice");
    expect(co[0].username).toBe("bob");
    expect(co[0].numPlays).toBe(2);
    expect(co[0].user.displayName).toBe("Bobby");
    // El invitado sin username queda con user null.
    expect(co.find((c) => c.name === "Invitado").user).toBeNull();
  });

  it("refleja las fusiones del overlay (cuenta dos compañeros como uno)", async () => {
    // Dos identidades crudas distintas: "Juan" (sin username) y "Juancho".
    await makePlay({ players: [{ name: "Juan" }] });
    await makePlay({ players: [{ name: "Juan" }] });
    await makePlay({ players: [{ name: "Juancho" }] });
    // El overlay los fusiona en una sola identidad curada.
    await BggPlayerOverlay.create({
      ownerUsername: "alice",
      rawKeys: ["n:juan", "n:juancho"],
      nameOverride: "Juancito",
    });

    const co = await topCoPlayers("alice");
    const juancito = co.filter((c) => c.name === "Juancito");
    expect(juancito).toHaveLength(1);
    expect(juancito[0].numPlays).toBe(3);
    // Ya no aparecen como entradas separadas.
    expect(co.some((c) => c.name === "Juancho")).toBe(false);
  });
});

describe("headToHead", () => {
  it("talla victorias y deduplica la sesión compartida", async () => {
    await createUser({ bggUsername: "alice", displayName: "Alicia" });
    await createUser({ bggUsername: "bob", displayName: "Bobby" });
    const session = {
      gameId: "100",
      gameName: "Catan",
      date: "2026-02-01",
      players: [
        { username: "alice", win: true },
        { username: "bob", win: false },
      ],
    };
    // Misma sesión logueada por ambos (distinto playId) → debe contar 1 sola.
    await makePlay({ bggUsername: "alice", ...session });
    await makePlay({ bggUsername: "bob", ...session });
    // Otra partida, gana bob.
    await makePlay({
      bggUsername: "alice",
      gameId: "200",
      gameName: "Otro",
      date: "2026-02-02",
      players: [
        { username: "alice", win: false },
        { username: "bob", win: true },
      ],
    });

    const h2h = await headToHead("alice", "bob");
    expect(h2h.total).toBe(2);
    expect(h2h.aWins).toBe(1);
    expect(h2h.bWins).toBe(1);
    expect(h2h.userA.user.displayName).toBe("Alicia");
    expect(h2h.byGame).toHaveLength(2);
  });
});

describe("communityActivityFeed", () => {
  it("devuelve plays recientes paginadas con logger y players resueltos", async () => {
    await createUser({ bggUsername: "alice", displayName: "Alicia" });
    await makePlay({ bggUsername: "alice", date: "2026-03-01" });
    await makePlay({ bggUsername: "alice", date: "2026-03-05" });
    await makePlay({ bggUsername: "alice", date: "2026-03-03" });

    const feed = await communityActivityFeed({ page: 1, limit: 2 });
    expect(feed.total).toBe(3);
    expect(feed.pages).toBe(2);
    expect(feed.items).toHaveLength(2);
    // Orden date desc.
    expect(feed.items[0].date).toBe("2026-03-05");
    expect(feed.items[1].date).toBe("2026-03-03");
    expect(feed.items[0].logger.displayName).toBe("Alicia");
  });
});

describe("communityActivityHeatmap", () => {
  it("cuenta partidas por día", async () => {
    await makePlay({ date: "2026-04-01", quantity: 1 });
    await makePlay({ date: "2026-04-01", quantity: 2 });
    await makePlay({ date: "2026-04-02", quantity: 1 });
    const heat = await communityActivityHeatmap({});
    expect(heat).toEqual([
      { date: "2026-04-01", count: 3 },
      { date: "2026-04-02", count: 1 },
    ]);
  });
});

describe("playerGameRank", () => {
  it("devuelve rank/total/numPlays del usuario en un juego", async () => {
    await makePlay({ bggUsername: "alice", gameId: "100", quantity: 5 });
    await makePlay({ bggUsername: "bob", gameId: "100", quantity: 2 });
    const rank = await playerGameRank("bob", "100");
    expect(rank).toEqual({ rank: 2, total: 2, numPlays: 2 });
  });

  it("devuelve null si el usuario no jugó ese juego", async () => {
    await makePlay({ bggUsername: "alice", gameId: "100" });
    const rank = await playerGameRank("ghost", "100");
    expect(rank).toBeNull();
  });
});
