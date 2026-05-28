const YoutubeVideoCache = require("../../../../models/YoutubeVideoCache");
const {
  resolveVideo,
  parseYouTubeVideoId,
  VIDEO_ID_REGEX,
} = require("../../../../services/youtube/youtubeVideo");

describe("parseYouTubeVideoId (server)", () => {
  it("acepta ID puro", () => {
    expect(parseYouTubeVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extrae de varios formatos de URL", () => {
    expect(
      parseYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(
      parseYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
    expect(
      parseYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("devuelve null para inputs inválidos", () => {
    expect(parseYouTubeVideoId("")).toBeNull();
    expect(parseYouTubeVideoId(null)).toBeNull();
    expect(parseYouTubeVideoId("https://vimeo.com/12345")).toBeNull();
    expect(
      parseYouTubeVideoId("https://www.youtube.com/watch?v=short"),
    ).toBeNull();
  });
});

describe("VIDEO_ID_REGEX", () => {
  it("matchea solo IDs válidos", () => {
    expect(VIDEO_ID_REGEX.test("dQw4w9WgXcQ")).toBe(true);
    expect(VIDEO_ID_REGEX.test("short")).toBe(false);
    expect(VIDEO_ID_REGEX.test("toolongtoolong")).toBe(false);
    expect(VIDEO_ID_REGEX.test("11_chars!_x")).toBe(false);
  });
});

describe("resolveVideo", () => {
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

  it("tira httpError 400 con videoId inválido", async () => {
    await expect(resolveVideo("short")).rejects.toMatchObject({
      status: 400,
    });
    await expect(resolveVideo("")).rejects.toMatchObject({ status: 400 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sirve del cache (no llama a YouTube)", async () => {
    await YoutubeVideoCache.create({
      videoId: "dQw4w9WgXcQ",
      title: "Cached title",
      channel: "Cached channel",
      thumbnail: "cached-thumb",
      duration: "10:00",
      lastFetchedAt: new Date(),
    });

    const result = await resolveVideo("dQw4w9WgXcQ");
    expect(result).toMatchObject({
      videoId: "dQw4w9WgXcQ",
      title: "Cached title",
      channel: "Cached channel",
      duration: "10:00",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sin API key devuelve fallback (thumbnail directo) sin persistir cache", async () => {
    delete process.env.YOUTUBE_API_KEY;

    const result = await resolveVideo("dQw4w9WgXcQ");
    expect(result).toEqual({
      videoId: "dQw4w9WgXcQ",
      title: "",
      channel: "",
      thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
      duration: "",
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    const doc = await YoutubeVideoCache.findOne({
      videoId: "dQw4w9WgXcQ",
    }).lean();
    expect(doc).toBeNull();
  });

  it("happy path: cache miss + YouTube OK → persiste y devuelve metadata", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: "dQw4w9WgXcQ",
            snippet: {
              title: "Cómo se juega Catan",
              channelTitle: "BoardgameAR",
              thumbnails: {
                medium: {
                  url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
                },
              },
            },
            contentDetails: { duration: "PT12M34S" },
          },
        ],
      }),
    });

    const result = await resolveVideo("dQw4w9WgXcQ");
    expect(result).toEqual({
      videoId: "dQw4w9WgXcQ",
      title: "Cómo se juega Catan",
      channel: "BoardgameAR",
      thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
      duration: "12:34",
    });

    const doc = await YoutubeVideoCache.findOne({
      videoId: "dQw4w9WgXcQ",
    }).lean();
    expect(doc).toBeTruthy();
    expect(doc.title).toBe("Cómo se juega Catan");
  });

  it("YouTube 403/network error → fallback sin persistir cache", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        error: { errors: [{ reason: "quotaExceeded" }] },
      }),
    });

    const result = await resolveVideo("dQw4w9WgXcQ");
    expect(result.title).toBe("");
    expect(result.thumbnail).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
    );

    const doc = await YoutubeVideoCache.findOne({
      videoId: "dQw4w9WgXcQ",
    }).lean();
    expect(doc).toBeNull();
  });

  it("Video no encontrado (items vacíos) → fallback sin persistir", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    });

    const result = await resolveVideo("dQw4w9WgXcQ");
    expect(result.title).toBe("");
    expect(result.thumbnail).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
    );

    const doc = await YoutubeVideoCache.findOne({
      videoId: "dQw4w9WgXcQ",
    }).lean();
    expect(doc).toBeNull();
  });
});
