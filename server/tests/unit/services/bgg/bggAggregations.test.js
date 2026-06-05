const BggPlay = require("../../../../models/BggPlay");
const {
  computeGameStats,
  computePlayedGames,
  computePlayedGamesWithRecency,
  mergeUserGameList,
  computeTopPlayedGame,
} = require("../../../../services/bgg/bggAggregations");

async function makePlay(overrides = {}) {
  return BggPlay.create({
    bggUsername: "alice",
    playId: String(Math.floor(Math.random() * 1e9)),
    gameId: "100",
    gameName: "Catan",
    // BggPlay.date es `String` (YYYY-MM-DD) tal como viene del XML de BGG,
    // no Date — el ordering funciona igual porque ISO ordena lex.
    date: "2026-01-01",
    quantity: 1,
    duration: 60,
    players: [
      { username: "alice", win: true, score: "10" },
      { username: "bob", win: false, score: "5" },
    ],
    hash: "x".repeat(40),
    ...overrides,
  });
}

describe("computeGameStats", () => {
  it("devuelve ceros cuando no hay plays", async () => {
    const stats = await computeGameStats("alice", "100");
    expect(stats).toEqual({
      wins: 0,
      rated: 0,
      avgDuration: null,
      lastDate: null,
    });
  });

  it("cuenta wins solo cuando alice (case-insensitive) está en players y win=true", async () => {
    await makePlay({
      players: [
        { username: "Alice", win: true },
        { username: "bob", win: false },
      ],
    });
    await makePlay({
      players: [
        { username: "ALICE", win: false },
        { username: "bob", win: true },
      ],
    });
    const stats = await computeGameStats("alice", "100");
    expect(stats.wins).toBe(1);
    expect(stats.rated).toBe(2);
  });

  it("rated cuenta plays donde el user aparece en players (con o sin win)", async () => {
    await makePlay({ players: [{ username: "alice", win: true }] });
    await makePlay({ players: [{ username: "alice", win: false }] });
    // Play sin alice — no se cuenta como rated.
    await makePlay({ players: [{ username: "bob", win: true }] });
    const stats = await computeGameStats("alice", "100");
    expect(stats.rated).toBe(2);
    expect(stats.wins).toBe(1);
  });

  it("avgDuration ignora duration=0 y devuelve null cuando no hay durations", async () => {
    await makePlay({
      duration: 60,
      players: [{ username: "alice", win: true }],
    });
    await makePlay({
      duration: 90,
      players: [{ username: "alice", win: true }],
    });
    // Play con duration=0 no debe afectar el promedio.
    await makePlay({
      duration: 0,
      players: [{ username: "alice", win: true }],
    });
    const stats = await computeGameStats("alice", "100");
    expect(stats.avgDuration).toBe(75);
  });

  it("lastDate es la fecha más reciente entre las plays", async () => {
    await makePlay({ date: "2026-01-01" });
    await makePlay({ date: "2026-03-15" });
    await makePlay({ date: "2025-12-01" });
    const stats = await computeGameStats("alice", "100");
    expect(stats.lastDate).toBe("2026-03-15");
  });

  it("filtra por gameId — plays de otros juegos no cuentan", async () => {
    await makePlay({ gameId: "100" });
    await makePlay({ gameId: "200" });
    const stats = await computeGameStats("alice", "100");
    expect(stats.rated).toBe(1);
  });
});

describe("computePlayedGames", () => {
  it("devuelve lista vacía si no hay plays", async () => {
    expect(await computePlayedGames("alice")).toEqual([]);
  });

  it("agrega por gameId con numPlays = suma de quantity", async () => {
    await makePlay({ gameId: "100", quantity: 2, gameName: "Catan" });
    await makePlay({ gameId: "100", quantity: 3, gameName: "Catan" });
    await makePlay({ gameId: "200", quantity: 1, gameName: "Risk" });
    const games = await computePlayedGames("alice");
    expect(games).toEqual([
      { id: "100", name: "Catan", thumbnail: null, numPlays: 5 },
      { id: "200", name: "Risk", thumbnail: null, numPlays: 1 },
    ]);
  });

  it("ordena por numPlays desc", async () => {
    await makePlay({ gameId: "100", quantity: 1 });
    await makePlay({ gameId: "200", quantity: 5 });
    await makePlay({ gameId: "300", quantity: 3 });
    const games = await computePlayedGames("alice");
    expect(games.map((g) => g.id)).toEqual(["200", "300", "100"]);
  });

  it("default quantity es 1 si falta", async () => {
    await makePlay({ gameId: "100", quantity: undefined });
    const games = await computePlayedGames("alice");
    expect(games[0].numPlays).toBe(1);
  });

  it("excluye plays sin gameId", async () => {
    await makePlay({ gameId: "100" });
    await makePlay({ gameId: null });
    const games = await computePlayedGames("alice");
    expect(games).toHaveLength(1);
  });

  it("filtra por bggUsername (lowercase)", async () => {
    await makePlay({ bggUsername: "alice", gameId: "100" });
    await makePlay({ bggUsername: "bob", gameId: "100" });
    expect(await computePlayedGames("alice")).toHaveLength(1);
    expect(await computePlayedGames("bob")).toHaveLength(1);
  });
});

describe("computePlayedGamesWithRecency", () => {
  it("devuelve lista vacía si no hay plays", async () => {
    expect(await computePlayedGamesWithRecency("alice")).toEqual([]);
  });

  it("lastPlayedDate = max date; numPlays = suma; name/thumbnail de la más reciente", async () => {
    await makePlay({
      gameId: "100",
      date: "2026-01-01",
      gameName: "Catan Viejo",
      gameThumbnail: "old.jpg",
      quantity: 2,
    });
    await makePlay({
      gameId: "100",
      date: "2026-03-15",
      gameName: "Catan Nuevo",
      gameThumbnail: "new.jpg",
      quantity: 1,
    });
    const games = await computePlayedGamesWithRecency("alice");
    expect(games).toHaveLength(1);
    expect(games[0]).toEqual({
      id: "100",
      name: "Catan Nuevo",
      thumbnail: "new.jpg",
      numPlays: 3,
      lastPlayedDate: "2026-03-15",
    });
  });

  it("excluye plays sin gameId", async () => {
    await makePlay({ gameId: "100" });
    await makePlay({ gameId: null });
    expect(await computePlayedGamesWithRecency("alice")).toHaveLength(1);
  });
});

describe("mergeUserGameList (pura)", () => {
  it("solo jugados → owned:false, normaliza forma", () => {
    const out = mergeUserGameList(
      [
        {
          id: "1",
          name: "Catan",
          thumbnail: "t1",
          numPlays: 3,
          lastPlayedDate: "2026-01-10",
        },
      ],
      [],
    );
    expect(out).toEqual([
      {
        id: "1",
        name: "Catan",
        thumbnail: "t1",
        image: null,
        year: null,
        numPlays: 3,
        lastPlayedDate: "2026-01-10",
        owned: false,
      },
    ]);
  });

  it("solo colección → owned:true, numPlays:0, image/year desde la colección", () => {
    const out = mergeUserGameList(
      [],
      [
        {
          id: "9",
          name: "Azul",
          thumbnail: "t9",
          image: "img9",
          yearPublished: 2017,
          numPlays: 4,
        },
      ],
    );
    expect(out).toEqual([
      {
        id: "9",
        name: "Azul",
        thumbnail: "t9",
        image: "img9",
        year: 2017,
        numPlays: 0,
        lastPlayedDate: null,
        owned: true,
      },
    ]);
  });

  it("unión: juego jugado Y poseído queda owned:true, conserva numPlays/recencia y toma image/year de la colección", () => {
    const out = mergeUserGameList(
      [
        {
          id: "1",
          name: "Catan",
          thumbnail: "tPlay",
          numPlays: 2,
          lastPlayedDate: "2026-01-10",
        },
      ],
      [
        {
          id: "1",
          name: "Catan",
          thumbnail: "tColl",
          image: "img1",
          yearPublished: 1995,
          numPlays: 9,
        },
      ],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "1",
      owned: true,
      numPlays: 2,
      lastPlayedDate: "2026-01-10",
      image: "img1",
      year: 1995,
    });
  });

  it("ordena por lastPlayedDate desc; los nunca-jugados (colección) van al fondo", () => {
    const out = mergeUserGameList(
      [
        { id: "1", name: "Aaa", numPlays: 2, lastPlayedDate: "2026-01-10" },
        { id: "2", name: "Bbb", numPlays: 5, lastPlayedDate: "2026-03-01" },
      ],
      [{ id: "3", name: "Zzz", yearPublished: 2000 }],
    );
    expect(out.map((g) => g.id)).toEqual(["2", "1", "3"]);
  });

  it("desempata por numPlays desc cuando la fecha empata", () => {
    const out = mergeUserGameList(
      [
        { id: "7", name: "G7", numPlays: 1, lastPlayedDate: "2026-02-02" },
        { id: "8", name: "G8", numPlays: 9, lastPlayedDate: "2026-02-02" },
      ],
      [],
    );
    expect(out.map((g) => g.id)).toEqual(["8", "7"]);
  });

  it("nunca-jugados de la colección se ordenan por nombre asc", () => {
    const out = mergeUserGameList(
      [],
      [
        { id: "5", name: "Zelda" },
        { id: "6", name: "Azul" },
      ],
    );
    expect(out.map((g) => g.id)).toEqual(["6", "5"]);
  });

  it("sin colección → solo jugados", () => {
    const out = mergeUserGameList([
      { id: "1", name: "Catan", numPlays: 1, lastPlayedDate: "2026-01-01" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].owned).toBe(false);
  });
});

describe("computeTopPlayedGame", () => {
  it("devuelve null si no hay plays", async () => {
    expect(await computeTopPlayedGame("alice")).toBeNull();
  });

  it("devuelve el game con más plays", async () => {
    await makePlay({ gameId: "100", quantity: 2, gameName: "Catan" });
    await makePlay({ gameId: "200", quantity: 5, gameName: "Risk" });
    const top = await computeTopPlayedGame("alice");
    expect(top).toMatchObject({ id: "200", name: "Risk", numPlays: 5 });
  });

  it("tiebreaker por gameId ascendente cuando empata", async () => {
    await makePlay({ gameId: "200", quantity: 3 });
    await makePlay({ gameId: "100", quantity: 3 });
    const top = await computeTopPlayedGame("alice");
    expect(top.id).toBe("100"); // gana el más bajo
  });

  it("excluye plays sin gameId", async () => {
    await makePlay({ gameId: null });
    expect(await computeTopPlayedGame("alice")).toBeNull();
  });
});
