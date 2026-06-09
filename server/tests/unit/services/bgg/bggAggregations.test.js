const BggPlay = require("../../../../models/BggPlay");
const {
  computeGameStats,
  computeOverallStats,
  computeActivityHeatmap,
  computeCoPlayerStats,
  computeLastJuntada,
  computePlayedGames,
  computePlayedGamesWithRecency,
  mergeUserGameList,
  computeTopPlayedGame,
  computePlayedLocations,
  computeLocationRoster,
  computeLocationStats,
  computeGamePlayCount,
  computePlayedCoPlayers,
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

  // selfKeys: el dueño puede figurar bajo un alias (sin username o con otra
  // cuenta) marcado "sos vos". Con la clave del alias en selfKeys, esas
  // partidas cuentan en su win-rate. Sin selfKeys, el default reproduce el
  // comportamiento previo (solo matchea su propio username).
  describe("selfKeys (curación 'sos vos')", () => {
    it("default: un alias sin username NO cuenta como el dueño", async () => {
      await makePlay({
        players: [{ name: "Juancho", username: "", win: true }],
      });
      const stats = await computeGameStats("alice", "100");
      expect(stats).toMatchObject({ wins: 0, rated: 0 });
    });

    it("incluye wins + rated de un alias por-nombre marcado isSelf", async () => {
      // El dueño se cargó como "Juancho" (sin username) y ganó.
      await makePlay({
        players: [{ name: "Juancho", username: "", win: true }],
      });
      // Otra donde figura con su username real y perdió.
      await makePlay({
        players: [{ name: "Alice", username: "alice", win: false }],
      });
      const stats = await computeGameStats("alice", "100", {
        selfKeys: ["u:alice", "n:juancho"],
      });
      expect(stats.rated).toBe(2);
      expect(stats.wins).toBe(1);
    });

    it("incluye un alias por-username extra (cuenta vieja) case-insensitive", async () => {
      await makePlay({
        players: [{ name: "Old", username: "CuentaVieja", win: true }],
      });
      const stats = await computeGameStats("alice", "100", {
        selfKeys: ["u:alice", "u:cuentavieja"],
      });
      expect(stats).toMatchObject({ wins: 1, rated: 1 });
    });

    it("trimea username/name antes de matchear las claves", async () => {
      await makePlay({
        players: [{ name: "  Juancho  ", username: "", win: true }],
      });
      const stats = await computeGameStats("alice", "100", {
        selfKeys: ["u:alice", "n:juancho"],
      });
      expect(stats).toMatchObject({ wins: 1, rated: 1 });
    });
  });
});

describe("computeOverallStats", () => {
  it("devuelve la forma de ceros cuando no hay plays", async () => {
    const stats = await computeOverallStats("alice");
    expect(stats).toEqual({
      totalWins: 0,
      totalRated: 0,
      totalPlays: 0,
      uniqueGames: 0,
      avgDuration: null,
      firstDate: null,
      lastDate: null,
    });
  });

  it("totalWins/totalRated solo cuentan plays con el dueño (case-insensitive)", async () => {
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
    // Play sin alice — no cuenta como rated.
    await makePlay({ players: [{ username: "bob", win: true }] });
    const stats = await computeOverallStats("alice");
    expect(stats.totalRated).toBe(2);
    expect(stats.totalWins).toBe(1);
  });

  it("totalPlays suma quantity de TODAS las plays (con o sin el dueño)", async () => {
    await makePlay({ quantity: 2, players: [{ username: "alice", win: true }] });
    await makePlay({ quantity: 3, players: [{ username: "bob", win: true }] });
    const stats = await computeOverallStats("alice");
    expect(stats.totalPlays).toBe(5);
    expect(stats.totalRated).toBe(1);
  });

  it("agrega a través de varios juegos (no filtra por gameId)", async () => {
    await makePlay({ gameId: "100", players: [{ username: "alice", win: true }] });
    await makePlay({ gameId: "200", players: [{ username: "alice", win: false }] });
    const stats = await computeOverallStats("alice");
    expect(stats.totalRated).toBe(2);
    expect(stats.uniqueGames).toBe(2);
  });

  it("selfKeys: un alias 'sos vos' suma a wins + rated", async () => {
    // El dueño jugó bajo el nombre "Ali" (sin username) y ganó.
    await makePlay({ players: [{ name: "Ali", username: "", win: true }] });
    // Otra con su username real, perdió.
    await makePlay({ players: [{ name: "Alice", username: "alice", win: false }] });
    const stats = await computeOverallStats("alice", {
      selfKeys: ["u:alice", "n:ali"],
    });
    expect(stats.totalRated).toBe(2);
    expect(stats.totalWins).toBe(1);
  });

  it("avgDuration ignora duration=0", async () => {
    await makePlay({ duration: 60, players: [{ username: "alice", win: true }] });
    await makePlay({ duration: 90, players: [{ username: "alice", win: true }] });
    await makePlay({ duration: 0, players: [{ username: "alice", win: true }] });
    const stats = await computeOverallStats("alice");
    expect(stats.avgDuration).toBe(75);
  });

  it("uniqueGames cuenta gameId distintos y excluye null", async () => {
    await makePlay({ gameId: "100" });
    await makePlay({ gameId: "100" });
    await makePlay({ gameId: "200" });
    await makePlay({ gameId: null });
    const stats = await computeOverallStats("alice");
    expect(stats.uniqueGames).toBe(2);
  });

  it("firstDate/lastDate son el min/max de las fechas", async () => {
    await makePlay({ date: "2026-01-01" });
    await makePlay({ date: "2026-03-15" });
    await makePlay({ date: "2025-12-01" });
    const stats = await computeOverallStats("alice");
    expect(stats.firstDate).toBe("2025-12-01");
    expect(stats.lastDate).toBe("2026-03-15");
  });

  it("filtra por bggUsername", async () => {
    await makePlay({ bggUsername: "alice", players: [{ username: "alice" }] });
    await makePlay({ bggUsername: "bob", players: [{ username: "bob" }] });
    expect((await computeOverallStats("alice")).totalPlays).toBe(1);
    expect((await computeOverallStats("bob")).totalPlays).toBe(1);
  });
});

describe("computeActivityHeatmap", () => {
  it("devuelve lista vacía si no hay plays", async () => {
    expect(await computeActivityHeatmap("alice")).toEqual([]);
  });

  it("agrupa por fecha sumando quantity, ordenado asc", async () => {
    await makePlay({ date: "2026-01-10", quantity: 2 });
    await makePlay({ date: "2026-01-10", quantity: 1 });
    await makePlay({ date: "2026-01-05", quantity: 1 });
    const heatmap = await computeActivityHeatmap("alice");
    expect(heatmap).toEqual([
      { date: "2026-01-05", count: 1 },
      { date: "2026-01-10", count: 3 },
    ]);
  });

  it("default quantity es 1 si falta", async () => {
    await makePlay({ date: "2026-02-01", quantity: undefined });
    const heatmap = await computeActivityHeatmap("alice");
    expect(heatmap[0]).toEqual({ date: "2026-02-01", count: 1 });
  });

  it("sinceDate filtra fechas anteriores a la ventana", async () => {
    await makePlay({ date: "2026-01-01" });
    await makePlay({ date: "2026-03-01" });
    const heatmap = await computeActivityHeatmap("alice", {
      sinceDate: "2026-02-01",
    });
    expect(heatmap).toEqual([{ date: "2026-03-01", count: 1 }]);
  });

  it("filtra por bggUsername", async () => {
    await makePlay({ bggUsername: "alice", date: "2026-01-01" });
    await makePlay({ bggUsername: "bob", date: "2026-01-01" });
    expect(await computeActivityHeatmap("alice")).toHaveLength(1);
    expect(await computeActivityHeatmap("bob")).toHaveLength(1);
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

describe("computePlayedLocations", () => {
  it("devuelve lista vacía si no hay plays", async () => {
    expect(await computePlayedLocations("alice")).toEqual([]);
  });

  it("agrupa por ubicación con numPlays = suma de quantity y lastPlayedDate = max", async () => {
    await makePlay({ location: "Casa", date: "2026-01-01", quantity: 2 });
    await makePlay({ location: "Casa", date: "2026-03-10", quantity: 1 });
    await makePlay({ location: "Club", date: "2026-02-05", quantity: 1 });
    const locs = await computePlayedLocations("alice");
    const casa = locs.find((l) => l.name === "Casa");
    const club = locs.find((l) => l.name === "Club");
    expect(casa).toEqual({
      name: "Casa",
      numPlays: 3,
      lastPlayedDate: "2026-03-10",
    });
    expect(club).toEqual({
      name: "Club",
      numPlays: 1,
      lastPlayedDate: "2026-02-05",
    });
  });

  it("ignora plays sin ubicación (null, vacío o solo espacios)", async () => {
    await makePlay({ location: "Casa" });
    await makePlay({ location: null });
    await makePlay({ location: "" });
    await makePlay({ location: "   " });
    const locs = await computePlayedLocations("alice");
    expect(locs).toHaveLength(1);
    expect(locs[0].name).toBe("Casa");
  });

  it("trimea la ubicación antes de agrupar", async () => {
    await makePlay({ location: "Casa" });
    await makePlay({ location: "  Casa  " });
    const locs = await computePlayedLocations("alice");
    expect(locs).toHaveLength(1);
    expect(locs[0]).toMatchObject({ name: "Casa", numPlays: 2 });
  });

  it("default quantity es 1 si falta", async () => {
    await makePlay({ location: "Casa", quantity: undefined });
    const locs = await computePlayedLocations("alice");
    expect(locs[0].numPlays).toBe(1);
  });

  it("filtra por bggUsername (lowercase)", async () => {
    await makePlay({ bggUsername: "alice", location: "Casa" });
    await makePlay({ bggUsername: "bob", location: "Oficina" });
    expect(await computePlayedLocations("alice")).toHaveLength(1);
    expect((await computePlayedLocations("alice"))[0].name).toBe("Casa");
    expect((await computePlayedLocations("bob"))[0].name).toBe("Oficina");
  });
});

describe("computeLocationRoster", () => {
  it("devuelve una key l:<lower> y agrupa case-insensitive", async () => {
    await makePlay({ location: "Casa", date: "2026-01-01", quantity: 1 });
    await makePlay({ location: "casa", date: "2026-03-10", quantity: 2 });
    await makePlay({ location: "Club", date: "2026-02-05", quantity: 1 });
    const roster = await computeLocationRoster("alice");
    const casa = roster.find((l) => l.key === "l:casa");
    expect(casa).toMatchObject({
      key: "l:casa",
      numPlays: 3, // 1 + 2 (ambas grafías colapsan)
      lastPlayedDate: "2026-03-10",
    });
    // El nombre representativo es la grafía más reciente.
    expect(casa.name).toBe("casa");
    expect(roster.find((l) => l.key === "l:club")).toMatchObject({
      key: "l:club",
      numPlays: 1,
    });
  });

  it("ignora ubicaciones vacías", async () => {
    await makePlay({ location: "Casa" });
    await makePlay({ location: null });
    await makePlay({ location: "  " });
    const roster = await computeLocationRoster("alice");
    expect(roster).toHaveLength(1);
    expect(roster[0].key).toBe("l:casa");
  });
});

describe("computeLocationStats", () => {
  it("talla partidas, juegos únicos, fechas y por-juego de una ubicación", async () => {
    await makePlay({
      location: "Casa",
      gameId: "100",
      gameName: "Catan",
      date: "2026-01-01",
    });
    await makePlay({
      location: "casa",
      gameId: "100",
      gameName: "Catan",
      date: "2026-03-01",
    });
    await makePlay({
      location: "Casa",
      gameId: "200",
      gameName: "Carcassonne",
      date: "2026-02-01",
    });
    // Otra ubicación → no cuenta.
    await makePlay({ location: "Club", gameId: "100", date: "2026-04-01" });

    const { stats, matchedPlays } = await computeLocationStats("alice", [
      "l:casa",
    ]);
    expect(stats.total).toBe(3);
    expect(stats.uniqueGames).toBe(2);
    expect(stats.firstPlayedDate).toBe("2026-01-01");
    expect(stats.lastPlayedDate).toBe("2026-03-01");
    // byGame ordenado por total desc (Catan 2, Carcassonne 1).
    expect(stats.byGame[0]).toMatchObject({ gameId: "100", total: 2 });
    expect(stats.byGame[1]).toMatchObject({ gameId: "200", total: 1 });
    // matchedPlays ordenado por fecha desc.
    expect(matchedPlays[0].date).toBe("2026-03-01");
  });

  it("devuelve ceros cuando la ubicación no tiene partidas", async () => {
    const { stats, matchedPlays } = await computeLocationStats("alice", [
      "l:inexistente",
    ]);
    expect(stats.total).toBe(0);
    expect(stats.uniqueGames).toBe(0);
    expect(stats.byGame).toEqual([]);
    expect(matchedPlays).toEqual([]);
  });
});

describe("computeGamePlayCount", () => {
  it("devuelve 0 cuando el usuario no jugó ese juego", async () => {
    await makePlay({ gameId: "100" });
    expect(await computeGamePlayCount("alice", "200")).toBe(0);
  });

  it("suma quantity de las partidas del juego", async () => {
    await makePlay({ gameId: "100", quantity: 2 });
    await makePlay({ gameId: "100", quantity: 3 });
    await makePlay({ gameId: "200", quantity: 1 });
    expect(await computeGamePlayCount("alice", "100")).toBe(5);
  });

  it("acepta gameId numérico o string", async () => {
    await makePlay({ gameId: "100", quantity: 1 });
    expect(await computeGamePlayCount("alice", 100)).toBe(1);
  });

  it("filtra por bggUsername", async () => {
    await makePlay({ bggUsername: "alice", gameId: "100" });
    await makePlay({ bggUsername: "bob", gameId: "100" });
    expect(await computeGamePlayCount("alice", "100")).toBe(1);
    expect(await computeGamePlayCount("bob", "100")).toBe(1);
  });
});

describe("computePlayedCoPlayers", () => {
  it("devuelve lista vacía si no hay plays", async () => {
    expect(await computePlayedCoPlayers("alice")).toEqual([]);
  });

  it("agrupa compañeros distintos y excluye al dueño", async () => {
    await makePlay({
      date: "2026-01-01",
      players: [
        { name: "Alice", username: "alice", win: true },
        { name: "Bob", username: "bob", win: false },
      ],
    });
    await makePlay({
      date: "2026-03-01",
      players: [
        { name: "Alice", username: "alice", win: false },
        { name: "Bob", username: "bob", win: true },
      ],
    });
    const co = await computePlayedCoPlayers("alice");
    expect(co).toHaveLength(1); // alice excluida, bob colapsado
    expect(co[0]).toEqual({
      name: "Bob",
      username: "bob",
      numPlays: 2,
      lastPlayedDate: "2026-03-01",
    });
  });

  it("agrupa por nombre cuando el jugador no tiene username", async () => {
    await makePlay({
      players: [
        { name: "Alice", username: "alice", win: true },
        { name: "Tía Susana", username: "", win: false },
      ],
    });
    await makePlay({
      players: [
        { name: "Alice", username: "alice", win: true },
        { name: "Tía Susana", username: "", win: false },
      ],
    });
    const co = await computePlayedCoPlayers("alice");
    expect(co).toHaveLength(1);
    expect(co[0]).toMatchObject({
      name: "Tía Susana",
      username: "",
      numPlays: 2,
    });
  });

  it("excluye al dueño de forma case-insensitive", async () => {
    await makePlay({
      players: [
        { name: "Alice", username: "ALICE", win: true },
        { name: "Bob", username: "bob", win: false },
      ],
    });
    const co = await computePlayedCoPlayers("alice");
    expect(co.map((c) => c.username)).toEqual(["bob"]);
  });

  it("ignora entradas sin nombre ni username", async () => {
    await makePlay({
      players: [
        { name: "Alice", username: "alice" },
        { name: "", username: "" },
      ],
    });
    const co = await computePlayedCoPlayers("alice");
    expect(co).toEqual([]);
  });

  it("excluye asientos 'Jugador anónimo N' (no se trackean como compañeros)", async () => {
    await makePlay({
      players: [
        { name: "Alice", username: "alice", win: true },
        { name: "Jugador anónimo 1", username: "", win: false },
        { name: "Jugador anónimo 2", username: "", win: false },
        { name: "Bob", username: "bob", win: false },
      ],
    });
    const co = await computePlayedCoPlayers("alice");
    expect(co.map((c) => c.name)).toEqual(["Bob"]);
  });

  it("NO excluye a un usuario BGG real que se llame parecido (tiene username)", async () => {
    await makePlay({
      players: [
        { name: "Alice", username: "alice" },
        { name: "Jugador anónimo", username: "anon_real" },
      ],
    });
    const co = await computePlayedCoPlayers("alice");
    expect(co.map((c) => c.username)).toEqual(["anon_real"]);
  });
});

describe("computeLastJuntada", () => {
  it("devuelve null si el usuario no tiene partidas", async () => {
    expect(await computeLastJuntada("nadie")).toBeNull();
  });

  it("devuelve el roster (sin score/win) + ubicación de la partida más reciente", async () => {
    await makePlay({
      date: "2026-01-01",
      location: "Casa de Ana",
      players: [
        { name: "Alice", username: "alice" },
        { name: "Bob", username: "bob" },
      ],
    });
    await makePlay({
      date: "2026-03-01",
      location: "Club",
      players: [
        { name: "Alice", username: "alice", score: "9", win: true },
        { name: "Carla", username: "carla" },
      ],
    });
    const juntada = await computeLastJuntada("alice");
    expect(juntada.location).toBe("Club");
    expect(juntada.players).toEqual([
      { name: "Alice", username: "alice" },
      { name: "Carla", username: "carla" },
    ]);
  });

  it("desempata por _id (insert más nuevo) con fechas iguales", async () => {
    await makePlay({
      date: "2026-05-01",
      location: "Primera",
      players: [{ name: "Alice", username: "alice" }],
    });
    await makePlay({
      date: "2026-05-01",
      location: "Segunda",
      players: [{ name: "Zoe", username: "zoe" }],
    });
    const juntada = await computeLastJuntada("alice");
    expect(juntada.location).toBe("Segunda");
  });

  it("excluye jugadores sin nombre ni username", async () => {
    await makePlay({
      date: "2026-04-01",
      players: [
        { name: "Alice", username: "alice" },
        { name: "", username: "" },
      ],
    });
    const juntada = await computeLastJuntada("alice");
    expect(juntada.players).toEqual([{ name: "Alice", username: "alice" }]);
  });

  it("no precarga asientos anónimos en la última juntada", async () => {
    await makePlay({
      date: "2026-04-02",
      players: [
        { name: "Alice", username: "alice" },
        { name: "Jugador anónimo 1", username: "" },
      ],
    });
    const juntada = await computeLastJuntada("alice");
    expect(juntada.players).toEqual([{ name: "Alice", username: "alice" }]);
  });
});

describe("computeCoPlayerStats", () => {
  it("devuelve ceros cuando no hay partidas con ese jugador", async () => {
    const { stats, matchedPlays } = await computeCoPlayerStats("alice", [
      "u:nadie",
    ]);
    expect(matchedPlays).toEqual([]);
    expect(stats).toMatchObject({
      total: 0,
      ownerWins: 0,
      playerWins: 0,
      draws: 0,
      byGame: [],
    });
  });

  it("tabula victorias del dueño vs el co-jugador (por username)", async () => {
    await makePlay({
      date: "2026-01-01",
      players: [
        { username: "alice", win: true },
        { username: "bob", win: false },
      ],
    });
    await makePlay({
      date: "2026-01-02",
      players: [
        { username: "alice", win: false },
        { username: "bob", win: true },
      ],
    });
    await makePlay({
      date: "2026-01-03",
      players: [
        { username: "alice", win: false },
        { username: "bob", win: false },
      ],
    });
    const { stats } = await computeCoPlayerStats("alice", ["u:bob"]);
    expect(stats.total).toBe(3);
    expect(stats.ownerWins).toBe(1);
    expect(stats.playerWins).toBe(1);
    expect(stats.draws).toBe(1);
    expect(stats.firstPlayedDate).toBe("2026-01-01");
    expect(stats.lastPlayedDate).toBe("2026-01-03");
  });

  it("no incluye partidas donde el co-jugador no aparece", async () => {
    await makePlay({
      date: "2026-02-01",
      players: [{ username: "alice", win: true }],
    });
    await makePlay({
      date: "2026-02-02",
      players: [
        { username: "alice", win: true },
        { username: "bob", win: false },
      ],
    });
    const { stats, matchedPlays } = await computeCoPlayerStats("alice", [
      "u:bob",
    ]);
    expect(stats.total).toBe(1);
    expect(matchedPlays).toHaveLength(1);
  });

  it("funciona para jugadores cargados solo por nombre (sin username)", async () => {
    await makePlay({
      date: "2026-03-01",
      players: [
        { username: "alice", win: false },
        { name: "Tía Marta", username: "" },
      ],
    });
    const { stats } = await computeCoPlayerStats("alice", ["n:tía marta"]);
    expect(stats.total).toBe(1);
  });

  it("desglosa por juego (ownerWins/playerWins/total)", async () => {
    await makePlay({
      gameId: "100",
      gameName: "Catan",
      date: "2026-04-01",
      players: [
        { username: "alice", win: true },
        { username: "bob", win: false },
      ],
    });
    await makePlay({
      gameId: "200",
      gameName: "Carcassonne",
      date: "2026-04-02",
      players: [
        { username: "alice", win: false },
        { username: "bob", win: true },
      ],
    });
    const { stats } = await computeCoPlayerStats("alice", ["u:bob"]);
    const byId = Object.fromEntries(stats.byGame.map((g) => [g.gameId, g]));
    expect(byId["100"]).toMatchObject({
      total: 1,
      ownerWins: 1,
      playerWins: 0,
    });
    expect(byId["200"]).toMatchObject({
      total: 1,
      ownerWins: 0,
      playerWins: 1,
    });
  });

  it("cuenta victorias del dueño bajo un alias 'sos vos' vía selfKeys", async () => {
    await makePlay({
      date: "2026-05-01",
      players: [
        { name: "Ali", username: "" },
        { username: "bob", win: false },
      ],
    });
    // "Ali" (n:ali) es el dueño; gana porque bob no ganó.
    const { stats } = await computeCoPlayerStats("alice", ["u:bob"], {
      selfKeys: ["u:alice", "n:ali"],
    });
    expect(stats.total).toBe(1);
    expect(stats.ownerWins).toBe(0); // nadie marcó win=true
    expect(stats.draws).toBe(1);
  });

  it("matchedPlays viene ordenado por fecha desc", async () => {
    await makePlay({
      date: "2026-06-01",
      players: [{ username: "alice" }, { username: "bob" }],
    });
    await makePlay({
      date: "2026-06-03",
      players: [{ username: "alice" }, { username: "bob" }],
    });
    await makePlay({
      date: "2026-06-02",
      players: [{ username: "alice" }, { username: "bob" }],
    });
    const { matchedPlays } = await computeCoPlayerStats("alice", ["u:bob"]);
    expect(matchedPlays.map((p) => p.date)).toEqual([
      "2026-06-03",
      "2026-06-02",
      "2026-06-01",
    ]);
  });
});
