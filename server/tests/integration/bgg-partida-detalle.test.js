const request = require("supertest");
const app = require("../../app");
const BggPlay = require("../../models/BggPlay");
const { createAuthedUser, authHeader } = require("../helpers/auth");

// GET /api/bgg/partida/:bggUsername/:playId — precarga una partida para editar.
// Solo el dueño (case-insensitive) o admin.

function playDoc(overrides) {
  return {
    bggUsername: "alice",
    playId: "play-1",
    gameId: "100",
    gameName: "Catan",
    gameThumbnail: "t100",
    date: "2026-03-01",
    duration: 60,
    location: "Casa",
    quantity: 1,
    comments: "buena",
    incomplete: false,
    nowinstats: false,
    players: [{ name: "Alice", username: "alice", win: true, score: "10" }],
    hash: "x".repeat(40),
    ...overrides,
  };
}

// XML de /plays para el fallback a BGG (usuario sin espejo en Mongo).
function playsXml(plays, total) {
  const content = plays
    .map(
      (p) => `
    <play id="${p.id}" date="${p.date}" quantity="1" length="90" incomplete="0" nowinstats="0" location="Casa">
      <item name="${p.gameName}" objecttype="thing" objectid="${p.gameId}"/>
      <players><player username="alice" name="Alice" startposition="1" score="42" win="1" new="0"/></players>
    </play>`,
    )
    .join("");
  return `<?xml version="1.0"?><plays username="alice" userid="1" total="${total ?? plays.length}" page="1">${content}</plays>`;
}

describe("GET /api/bgg/partida/:bggUsername/:playId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
  });

  it("401 sin autenticación", async () => {
    const res = await request(app).get("/api/bgg/partida/alice/play-1");
    expect(res.status).toBe(401);
  });

  it("el dueño obtiene la partida con la shape esperada", async () => {
    const { token } = await createAuthedUser({ bggUsername: "alice" });
    await BggPlay.create(playDoc());
    const res = await request(app)
      .get("/api/bgg/partida/alice/play-1")
      .set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: "play-1",
      gameId: "100",
      gameName: "Catan",
      gameThumbnail: "t100",
      date: "2026-03-01",
      duration: 60,
      location: "Casa",
      quantity: 1,
      comments: "buena",
      incomplete: false,
      nowinstats: false,
    });
    expect(res.body.players).toHaveLength(1);
    expect(res.body.players[0]).toMatchObject({ username: "alice", win: true });
  });

  it("matchea el dueño case-insensitive", async () => {
    const { token } = await createAuthedUser({ bggUsername: "Alice" });
    await BggPlay.create(playDoc());
    const res = await request(app)
      .get("/api/bgg/partida/alice/play-1")
      .set(authHeader(token));
    expect(res.status).toBe(200);
  });

  it("403 si no es el dueño", async () => {
    const { token } = await createAuthedUser({ bggUsername: "bob" });
    await BggPlay.create(playDoc());
    const res = await request(app)
      .get("/api/bgg/partida/alice/play-1")
      .set(authHeader(token));
    expect(res.status).toBe(403);
  });

  it("404 si la partida no existe", async () => {
    const { token } = await createAuthedUser({ bggUsername: "alice" });
    // Sin espejo en Mongo cae a BGG; mockeamos plays vacío → 404.
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => playsXml([], 0),
    }));
    const res = await request(app)
      .get("/api/bgg/partida/alice/nope")
      .set(authHeader(token));
    expect(res.status).toBe(404);
  });

  // ── Fallback a BGG cuando el usuario nunca sincronizó (#3) ──────────────
  it("sin espejo en Mongo, busca la partida en BGG (refresh/deep-link)", async () => {
    const { token } = await createAuthedUser({ bggUsername: "alice" });
    // NO se crea ningún BggPlay → entra al fallback.
    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("/plays")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            playsXml([
              { id: "p1", date: "2026-03-01", gameId: "100", gameName: "Catan" },
            ]),
        };
      }
      if (u.includes("/thing")) {
        return { ok: true, status: 200, text: async () => "<items></items>" };
      }
      throw new Error(`unmocked fetch: ${u}`);
    });

    const res = await request(app)
      .get("/api/bgg/partida/alice/p1")
      .set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: "p1",
      gameId: "100",
      gameName: "Catan",
      date: "2026-03-01",
      location: "Casa",
    });
    expect(res.body.players[0]).toMatchObject({ username: "alice", win: true });
  });

  it("con espejo en Mongo NO le pega a BGG (sirve local)", async () => {
    const { token } = await createAuthedUser({ bggUsername: "alice" });
    await BggPlay.create(playDoc());
    const fetchSpy = vi.fn(async () => {
      throw new Error("no debería pegarle a BGG");
    });
    global.fetch = fetchSpy;
    const res = await request(app)
      .get("/api/bgg/partida/alice/play-1")
      .set(authHeader(token));
    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
