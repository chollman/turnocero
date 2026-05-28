const request = require("supertest");
const app = require("../../app");
const YoutubeSearchCache = require("../../models/YoutubeSearchCache");

// ── Fixtures ─────────────────────────────────────────────────────────
function searchResponse(videos) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      items: videos.map((v) => ({
        id: { videoId: v.videoId },
        snippet: {
          title: v.title,
          channelTitle: v.channel,
          thumbnails: { medium: { url: v.thumbnail } },
        },
      })),
    }),
  };
}

function videosResponse(byId) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      items: Object.entries(byId).map(([id, duration]) => ({
        id,
        contentDetails: { duration },
      })),
    }),
  };
}

function errResponse(status, body = null) {
  return {
    ok: false,
    status,
    json: async () => body || {},
  };
}

// ── Suite ────────────────────────────────────────────────────────────
describe("GET /api/youtube/como-se-juega", () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.fn();
    global.fetch = fetchSpy;
    process.env.YOUTUBE_API_KEY = "test-yt-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
    delete process.env.YOUTUBE_API_KEY;
  });

  it("returns empty items for an empty query without calling YouTube", async () => {
    const res = await request(app)
      .get("/api/youtube/como-se-juega")
      .query({ juego: "" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns empty items when YOUTUBE_API_KEY is missing (graceful)", async () => {
    delete process.env.YOUTUBE_API_KEY;
    const res = await request(app)
      .get("/api/youtube/como-se-juega")
      .query({ juego: "Catan" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
    // No persiste cache cuando falta la key.
    const doc = await YoutubeSearchCache.findOne({ query: "catan" }).lean();
    expect(doc).toBeNull();
  });

  it("calls YouTube on cache miss, persists, and returns items with duration", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        searchResponse([
          {
            videoId: "abc1",
            title: "Cómo se juega Catan",
            channel: "Mesa de Juegos",
            thumbnail: "https://i.ytimg.com/vi/abc1/mqdefault.jpg",
          },
          {
            videoId: "abc2",
            title: "Reglas de Catan",
            channel: "Otra Canal",
            thumbnail: "https://i.ytimg.com/vi/abc2/mqdefault.jpg",
          },
          {
            videoId: "abc3",
            title: "Tutorial Catan en español",
            channel: "BoardgameAR",
            thumbnail: "https://i.ytimg.com/vi/abc3/mqdefault.jpg",
          },
        ]),
      )
      .mockResolvedValueOnce(
        videosResponse({
          abc1: "PT12M34S",
          abc2: "PT8M45S",
          abc3: "PT1H2M3S",
        }),
      );

    const res = await request(app)
      .get("/api/youtube/como-se-juega")
      .query({ juego: "Catan" });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.items[0]).toMatchObject({
      videoId: "abc1",
      title: "Cómo se juega Catan",
      channel: "Mesa de Juegos",
      thumbnail: "https://i.ytimg.com/vi/abc1/mqdefault.jpg",
      duration: "12:34",
    });
    expect(res.body.items[2].duration).toBe("1:02:03");
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Persistió en cache.
    const cached = await YoutubeSearchCache.findOne({ query: "catan" }).lean();
    expect(cached).toBeTruthy();
    expect(cached.items).toHaveLength(3);

    // Search URL incluye locale + región AR + query construida.
    const searchUrl = fetchSpy.mock.calls[0][0];
    expect(searchUrl).toContain("relevanceLanguage=es");
    expect(searchUrl).toContain("regionCode=AR");
    expect(searchUrl).toContain("Como+se+juega+Catan");
    expect(searchUrl).toContain("key=test-yt-key");
  });

  it("serves from cache on second identical query (no fetch)", async () => {
    await YoutubeSearchCache.create({
      query: "wingspan",
      items: [
        {
          videoId: "v1",
          title: "Wingspan tutorial",
          channel: "Birds",
          thumbnail: "thumb",
          duration: "10:00",
        },
      ],
      lastFetchedAt: new Date(),
    });

    const res = await request(app)
      .get("/api/youtube/como-se-juega")
      .query({ juego: "Wingspan" });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].videoId).toBe("v1");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("normalizes case/whitespace/accents → same cache row", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        searchResponse([
          {
            videoId: "x1",
            title: "T",
            channel: "C",
            thumbnail: "t",
          },
        ]),
      )
      .mockResolvedValueOnce(videosResponse({ x1: "PT5M" }));

    await request(app)
      .get("/api/youtube/como-se-juega")
      .query({ juego: "Cómo" });

    // Distinto case + accents + espacios → mismo cache key.
    const res = await request(app)
      .get("/api/youtube/como-se-juega")
      .query({ juego: "  COMO  " });

    expect(res.status).toBe(200);
    expect(res.body.items[0].videoId).toBe("x1");
    // Solo se llamó a YouTube una vez (en la primera request).
    expect(fetchSpy).toHaveBeenCalledTimes(2); // 1 search + 1 videos en la 1ra

    const docs = await YoutubeSearchCache.find({}).lean();
    expect(docs).toHaveLength(1);
    expect(docs[0].query).toBe("como");
  });

  it("returns empty items on search 403 quotaExceeded (no cache write)", async () => {
    fetchSpy.mockResolvedValueOnce(
      errResponse(403, {
        error: {
          errors: [{ reason: "quotaExceeded" }],
        },
      }),
    );

    const res = await request(app)
      .get("/api/youtube/como-se-juega")
      .query({ juego: "Catan" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });

    const doc = await YoutubeSearchCache.findOne({ query: "catan" }).lean();
    expect(doc).toBeNull();
  });

  it("returns empty items on search network failure (no cache write)", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("network down"));

    const res = await request(app)
      .get("/api/youtube/como-se-juega")
      .query({ juego: "Catan" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });

    const doc = await YoutubeSearchCache.findOne({ query: "catan" }).lean();
    expect(doc).toBeNull();
  });

  it("returns items with empty duration when /videos call fails (graceful)", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        searchResponse([
          {
            videoId: "x1",
            title: "T1",
            channel: "C",
            thumbnail: "t",
          },
        ]),
      )
      .mockRejectedValueOnce(new Error("videos down"));

    const res = await request(app)
      .get("/api/youtube/como-se-juega")
      .query({ juego: "Catan" });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].videoId).toBe("x1");
    expect(res.body.items[0].duration).toBe("");

    // Cache persistió aunque sin durations.
    const doc = await YoutubeSearchCache.findOne({ query: "catan" }).lean();
    expect(doc).toBeTruthy();
    expect(doc.items[0].duration).toBe("");
  });

  it("negative-caches empty results to avoid quota burn", async () => {
    fetchSpy.mockResolvedValueOnce(searchResponse([]));

    const res = await request(app)
      .get("/api/youtube/como-se-juega")
      .query({ juego: "Juego Inexistente XYZ" });

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    // Solo una llamada (no fue al /videos endpoint porque no había IDs).
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Cache row persistida con items vacíos.
    const doc = await YoutubeSearchCache.findOne({
      query: "juego inexistente xyz",
    }).lean();
    expect(doc).toBeTruthy();
    expect(doc.items).toEqual([]);

    // Segundo request sirve del cache sin llamar.
    fetchSpy.mockClear();
    const res2 = await request(app)
      .get("/api/youtube/como-se-juega")
      .query({ juego: "juego inexistente xyz" });
    expect(res2.body.items).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sets Cache-Control browser cache header", async () => {
    await YoutubeSearchCache.create({
      query: "catan",
      items: [],
      lastFetchedAt: new Date(),
    });

    const res = await request(app)
      .get("/api/youtube/como-se-juega")
      .query({ juego: "Catan" });

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toContain("max-age=300");
  });
});
