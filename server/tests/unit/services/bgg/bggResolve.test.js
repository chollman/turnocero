const BggGame = require("../../../../models/BggGame");
const BggCollection = require("../../../../models/BggCollection");
const {
  fetchBgg,
  persistGame,
  resolveGame,
  resolveGamesBatch,
  resolveCollection,
} = require("../../../../services/bgg/bggResolve");
const { _resetForTests } = require("../../../../services/bgg/bggCache");

beforeEach(() => {
  _resetForTests();
  vi.restoreAllMocks();
});

// ── fetchBgg ─────────────────────────────────────────────────────────

describe("fetchBgg", () => {
  it("devuelve el body como text en 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => "<xml/>",
      })),
    );
    expect(await fetchBgg("https://example.com")).toBe("<xml/>");
  });

  it("retries una vez tras 202 (BGG encolando)", async () => {
    const calls = [];
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        calls.push(url);
        if (calls.length === 1) {
          return { ok: true, status: 202, text: async () => "" };
        }
        return { ok: true, status: 200, text: async () => "<ok/>" };
      }),
    );
    const promise = fetchBgg("https://x");
    // El setTimeout(2000) interno del retry.
    await vi.advanceTimersByTimeAsync(2100);
    const result = await promise;
    expect(result).toBe("<ok/>");
    expect(calls).toHaveLength(2);
    vi.useRealTimers();
  });

  it("tira con err.status si BGG responde !ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 404,
        text: async () => "not found",
      })),
    );
    await expect(fetchBgg("https://x")).rejects.toMatchObject({ status: 404 });
  });
});

// ── persistGame + resolveGame ────────────────────────────────────────

describe("persistGame", () => {
  it("upsert un game nuevo en BggGame", async () => {
    await persistGame({
      id: 42,
      name: "Catan",
      thumbnail: "t",
      image: "i",
      year: 1995,
      minPlayers: 3,
      maxPlayers: 4,
    });
    const doc = await BggGame.findOne({ gameId: 42 });
    expect(doc.name).toBe("Catan");
    expect(doc.image).toBe("i");
    expect(doc.lastFetchedAt).toBeInstanceOf(Date);
  });

  it("actualiza un game existente preservando gameId", async () => {
    await persistGame({ id: 42, name: "Old", year: 1990 });
    await persistGame({ id: 42, name: "New", year: 2000 });
    const docs = await BggGame.find({ gameId: 42 });
    expect(docs).toHaveLength(1);
    expect(docs[0].name).toBe("New");
    expect(docs[0].yearPublished).toBe(2000);
  });
});

describe("resolveGame", () => {
  it("devuelve null para gameId inválido", async () => {
    expect(await resolveGame(0)).toBeNull();
    expect(await resolveGame(-5)).toBeNull();
    expect(await resolveGame("abc")).toBeNull();
    expect(await resolveGame(null)).toBeNull();
  });

  it("hits Mongo si el game está persistido (skip BGG)", async () => {
    await BggGame.create({
      gameId: 42,
      name: "Catan",
      thumbnail: "t",
      image: "i",
      yearPublished: 1995,
      minPlayers: 3,
      maxPlayers: 4,
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const game = await resolveGame(42);
    expect(game).toMatchObject({ id: 42, name: "Catan", year: 1995 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("cachea en L1 después del primer hit a Mongo", async () => {
    await BggGame.create({ gameId: 7, name: "X" });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await resolveGame(7);
    // Borrar el doc en Mongo no afecta el cache L1.
    await BggGame.deleteOne({ gameId: 7 });
    const cached = await resolveGame(7);
    expect(cached.name).toBe("X");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("va a BGG si Mongo no tiene el game, persiste el resultado", async () => {
    const xml = `<?xml version="1.0"?>
      <items>
        <item id="99" type="boardgame">
          <name type="primary" value="Risk"/>
          <thumbnail>r-thumb</thumbnail>
          <image>r-img</image>
          <yearpublished value="1957"/>
          <minplayers value="2"/>
          <maxplayers value="6"/>
        </item>
      </items>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, text: async () => xml })),
    );

    const game = await resolveGame(99);
    expect(game).toMatchObject({ id: 99, name: "Risk", year: 1957 });
    const persisted = await BggGame.findOne({ gameId: 99 });
    expect(persisted.name).toBe("Risk");
  });

  it("devuelve null si BGG no encuentra el game", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => `<items></items>`,
      })),
    );
    expect(await resolveGame(99999)).toBeNull();
  });
});

// ── resolveGamesBatch ────────────────────────────────────────────────

describe("resolveGamesBatch", () => {
  it("devuelve Map vacío para input vacío", async () => {
    const result = await resolveGamesBatch([]);
    expect(result.size).toBe(0);
  });

  it("dedupea ids repetidos y filtra inválidos", async () => {
    await BggGame.create({ gameId: 1, name: "A" });
    await BggGame.create({ gameId: 2, name: "B" });
    vi.stubGlobal("fetch", vi.fn());
    const result = await resolveGamesBatch([1, 1, 2, 0, -5, "abc", null]);
    expect(result.size).toBe(2);
    expect(result.get(1).name).toBe("A");
    expect(result.get(2).name).toBe("B");
  });

  it("hits Mongo en batch, sin BGG si todos están persistidos", async () => {
    await BggGame.create({ gameId: 1, name: "A" });
    await BggGame.create({ gameId: 2, name: "B" });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await resolveGamesBatch([1, 2]);
    expect(result.size).toBe(2);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("pide a BGG solo los faltantes (mix Mongo + BGG)", async () => {
    await BggGame.create({ gameId: 1, name: "FromMongo" });
    const xml = `<items>
      <item id="2"><name type="primary" value="FromBGG"/></item>
    </items>`;
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => xml,
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await resolveGamesBatch([1, 2]);
    expect(result.size).toBe(2);
    expect(result.get(1).name).toBe("FromMongo");
    expect(result.get(2).name).toBe("FromBGG");
    // Solo se llama 1 vez (chunk size 20 — entran todos los missing en 1 fetch).
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

// ── resolveCollection ───────────────────────────────────────────────

describe("resolveCollection", () => {
  it("hits BGG cuando no hay nada en Mongo ni cache", async () => {
    const xml = `<items>
      <item objectid="42">
        <name>Catan</name>
        <thumbnail>t</thumbnail>
        <numplays>3</numplays>
      </item>
    </items>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, text: async () => xml })),
    );
    const games = await resolveCollection("alice");
    expect(games).toHaveLength(1);
    expect(games[0].id).toBe("42");
    // Persiste en BggCollection.
    const doc = await BggCollection.findOne({ bggUsername: "alice" });
    expect(doc.games).toHaveLength(1);
  });

  it("hits Mongo si el doc está fresco (<6h)", async () => {
    await BggCollection.create({
      bggUsername: "alice",
      games: [{ id: "1", name: "Cached" }],
      lastFetchedAt: new Date(Date.now() - 60 * 60 * 1000), // 1h atrás
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const games = await resolveCollection("alice");
    expect(games[0].name).toBe("Cached");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("revalida con BGG si el doc Mongo es viejo (>6h)", async () => {
    await BggCollection.create({
      bggUsername: "alice",
      games: [{ id: "1", name: "Stale" }],
      lastFetchedAt: new Date(Date.now() - 7 * 60 * 60 * 1000), // 7h atrás
    });
    const xml = `<items><item objectid="2"><name>Fresh</name></item></items>`;
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => xml,
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const games = await resolveCollection("alice");
    expect(games[0].id).toBe("2");
    expect(games[0].name).toBe("Fresh");
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("forceRefresh bypassea cache L1 y Mongo TTL — siempre va a BGG", async () => {
    await BggCollection.create({
      bggUsername: "alice",
      games: [{ id: "1", name: "Cached" }],
      lastFetchedAt: new Date(),
    });
    const xml = `<items><item objectid="2"><name>Fresh</name></item></items>`;
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => xml,
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const games = await resolveCollection("alice", { forceRefresh: true });
    expect(games[0].id).toBe("2");
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("tira con status 404 si BGG no encuentra el user", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => `<no-items/>`,
      })),
    );
    await expect(resolveCollection("nadie")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("normaliza bggUsername a lowercase al guardar/buscar", async () => {
    const xml = `<items><item objectid="1"><name>X</name></item></items>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, text: async () => xml })),
    );
    await resolveCollection("MixedCase");
    const doc = await BggCollection.findOne({ bggUsername: "mixedcase" });
    expect(doc).toBeTruthy();
  });
});
