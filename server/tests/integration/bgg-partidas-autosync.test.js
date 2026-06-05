const request = require("supertest");
const app = require("../../app");
const BggPlay = require("../../models/BggPlay");
const BggGame = require("../../models/BggGame");
const User = require("../../models/User");
const { createAuthedUser, authHeader } = require("../helpers/auth");
const bggRouter = require("../../routes/bgg");

// Auto-refresco sincrónico de partidas al entrar a BG Watch.
//
// Comportamiento: cuando el DUEÑO (o un admin) ve un perfil cuyo último probe
// es viejo (> AUTO_REFRESH_STALE_MS = 3 h), el GET corre el probe()
// SINCRÓNICAMENTE y sirve datos frescos en la misma respuesta — en vez de
// dispararlo en background (que recién mostraría lo nuevo en la próxima
// visita). El path no-dueño / probe-reciente NO bloquea. La respuesta del
// path Mongo lleva un bloque `sync` con la metadata de frescura para el label
// "Actualizado hace X".

function ok(body) {
  return { ok: true, status: 200, text: async () => body };
}

function playsXml(plays = [], total = plays.length) {
  const content = plays
    .map(
      (p) => `
    <play id="${p.id}" date="${p.date}" quantity="1" length="60" incomplete="0" nowinstats="0" location="">
      <item name="${p.gameName || "Game"}" objecttype="thing" objectid="${p.gameId}"/>
      <players><player username="" name="Solo" startposition="" color="" score="" rating="0" new="0" win="1"/></players>
    </play>
  `,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><plays username="u" userid="1" total="${total}" page="1">${content}</plays>`;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("GET /api/bgg/partidas — auto-refresco sincrónico al entrar", () => {
  let fetchSpy;

  beforeEach(() => {
    bggRouter.__resetCache();
    fetchSpy = vi.fn();
    global.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
  });

  it("dueño con probe viejo (>3h) → probe sincrónico: la partida nueva aparece en la misma respuesta", async () => {
    const { user, token } = await createAuthedUser({
      bggUsername: "owner1",
      bggSync: {
        lastProbedAt: new Date(Date.now() - 4 * HOUR),
        lastFullSyncAt: new Date(Date.now() - 1 * DAY), // reconcile NO vencido
      },
    });
    expect(user.bggUsername).toBe("owner1");

    // Estado local: 1 partida. Pre-seed BggGame para que resolveGamesBatch no
    // pegue a /thing (así solo mockeamos /plays).
    await BggGame.create({ gameId: 100, name: "Catan", thumbnail: "t" });
    await BggPlay.create({
      bggUsername: "owner1",
      playId: "1",
      gameId: "100",
      date: "2026-01-01",
      players: [],
      hash: "stale",
    });

    // BGG ahora reporta 2 partidas (total=2): drift por count → reconcile
    // dirigido inserta la nueva ("2").
    fetchSpy.mockResolvedValue(
      ok(
        playsXml(
          [
            { id: "2", date: "2026-02-01", gameId: "100" },
            { id: "1", date: "2026-01-01", gameId: "100" },
          ],
          2,
        ),
      ),
    );

    const before = Date.now();
    const res = await request(app)
      .get("/api/bgg/partidas/owner1")
      .set(authHeader(token));

    expect(res.status).toBe(200);
    // La partida nueva está en la respuesta de ESTA request (no la próxima).
    expect(res.body.total).toBe(2);
    expect(res.body.plays.map((p) => p.id)).toContain("2");
    // Mongo quedó actualizado.
    expect(await BggPlay.countDocuments({ bggUsername: "owner1" })).toBe(2);
    // Metadata de frescura fresca.
    expect(res.body.sync).toBeTruthy();
    expect(new Date(res.body.sync.lastProbedAt).getTime()).toBeGreaterThanOrEqual(
      before,
    );

    // El stamp persistió en el User.
    const u = await User.findOne({ bggUsername: "owner1" }).lean();
    expect(new Date(u.bggSync.lastProbedAt).getTime()).toBeGreaterThanOrEqual(
      before,
    );
  });

  it("dueño con probe reciente (<5min) → NO pega a BGG, sirve Mongo tal cual + bloque sync", async () => {
    const stamp = new Date(Date.now() - 60 * 1000); // hace 1 min
    const { token } = await createAuthedUser({
      bggUsername: "owner2",
      bggSync: {
        lastProbedAt: stamp,
        lastFullSyncAt: new Date(Date.now() - 1 * DAY),
        lastProbeOutcome: "no_drift",
      },
    });
    await BggPlay.create({
      bggUsername: "owner2",
      playId: "1",
      gameId: "100",
      date: "2026-01-01",
      players: [],
      hash: "h",
    });

    const res = await request(app)
      .get("/api/bgg/partidas/owner2")
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    // Nada de BGG: ni sincrónico ni background.
    expect(fetchSpy).not.toHaveBeenCalled();
    // El bloque sync refleja el stamp guardado (no se tocó).
    expect(res.body.sync.lastProbedAt).toBeTruthy();
    expect(res.body.sync.lastProbeOutcome).toBe("no_drift");
    expect(new Date(res.body.sync.lastProbedAt).getTime()).toBe(stamp.getTime());
  });

  it("sin auth (anónimo) → el GET sigue funcionando y trae el bloque sync (regresión optionalAuth)", async () => {
    // Perfil con dueño pero probe reciente → sin background, determinista.
    await createAuthedUser({
      bggUsername: "owner3",
      bggSync: {
        lastProbedAt: new Date(Date.now() - 60 * 1000),
        lastFullSyncAt: new Date(Date.now() - 1 * DAY),
      },
    });
    await BggPlay.create({
      bggUsername: "owner3",
      playId: "1",
      gameId: "100",
      date: "2026-01-01",
      players: [],
      hash: "h",
    });

    const res = await request(app).get("/api/bgg/partidas/owner3");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body).toHaveProperty("sync");
    // Anónimo no es dueño → no dispara probe sincrónico.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
