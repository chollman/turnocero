const request = require("supertest");
const app = require("../../app");
const BggCollection = require("../../models/BggCollection");
const BggPlay = require("../../models/BggPlay");
const User = require("../../models/User");
const { createUser } = require("../helpers/auth");
const bggRouter = require("../../routes/bgg");

// Server-enforced cooldown for the manual "Actualizar" button on BG Watch.
// Tests cover:
//   - 429 when refresh is repeated within MANUAL_REFRESH_COOLDOWN_MS (60s)
//   - X-Refresh-Cooldown-Ms header on 200 and 429
//   - Independent cooldowns for partidas vs coleccion
//   - Mongo stamping in User.bggSync.lastManualRefresh*At
//   - No cooldown applies to non-refresh GETs (regression guard)
//   - Anon hits (no Turnocero User owning the bggUsername) still get served

function ok(body) {
  return { ok: true, status: 200, text: async () => body };
}

function collectionXml(items = []) {
  const xmlItems = items
    .map(
      (i) => `
      <item objectid="${i.id}">
        <name>${i.name}</name>
        <thumbnail>${i.thumbnail || ""}</thumbnail>
        <yearpublished>${i.year || ""}</yearpublished>
        <numplays>${i.numPlays || 0}</numplays>
        <stats><rating value="${i.userRating ?? "N/A"}"><average value="${i.bggRating || ""}"/></rating></stats>
      </item>
    `,
    )
    .join("");
  return `<?xml version="1.0"?><items>${xmlItems}</items>`;
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

describe("BGG manual refresh cooldown (server-side)", () => {
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

  // ── /coleccion ───────────────────────────────────────────────────
  describe("GET /api/bgg/coleccion/:user", () => {
    it("first ?refresh=1 succeeds, second within the window is 429 with retryAfterMs + header", async () => {
      await createUser({ bggUsername: "alice" });
      // Two BGG responses queued — but the second refresh should be blocked
      // by the cooldown so only the first will actually fire.
      fetchSpy.mockResolvedValueOnce(
        ok(collectionXml([{ id: "1", name: "G", thumbnail: "t" }])),
      );

      const ok1 = await request(app).get("/api/bgg/coleccion/alice?refresh=1");
      expect(ok1.status).toBe(200);
      // The header should now indicate the cooldown is active (close to 60_000 ms).
      const cooldownAfterFirst = Number(
        ok1.headers["x-refresh-cooldown-ms"],
      );
      expect(cooldownAfterFirst).toBeGreaterThan(50_000);
      expect(cooldownAfterFirst).toBeLessThanOrEqual(60_000);

      const blocked = await request(app).get(
        "/api/bgg/coleccion/alice?refresh=1",
      );
      expect(blocked.status).toBe(429);
      expect(blocked.body.retryAfterMs).toBeGreaterThan(0);
      expect(blocked.body.message).toMatch(/Esperá/);
      expect(Number(blocked.headers["x-refresh-cooldown-ms"])).toBeGreaterThan(
        0,
      );
      // Only the first refresh actually hit BGG.
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("non-refresh GET after a refresh does NOT increment cooldown and still serves", async () => {
      await createUser({ bggUsername: "bob" });
      // Seed Mongo so the no-refresh GET serves from L2 without hitting BGG.
      await BggCollection.create({
        bggUsername: "bob",
        games: [{ id: "1", name: "Cached", thumbnail: "c" }],
      });

      // Stamp a recent manual refresh manually so we don't have to fire one.
      await User.updateOne(
        { bggUsername: "bob" },
        {
          $set: { "bggSync.lastManualRefreshColeccionAt": new Date() },
        },
      );

      const res = await request(app).get("/api/bgg/coleccion/bob");
      expect(res.status).toBe(200);
      // Header still present (reflects the active cooldown from the earlier stamp).
      expect(Number(res.headers["x-refresh-cooldown-ms"])).toBeGreaterThan(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("stamps lastManualRefreshColeccionAt in Mongo after a successful refresh", async () => {
      await createUser({ bggUsername: "charlie" });
      fetchSpy.mockResolvedValueOnce(ok(collectionXml([{ id: "1", name: "G", thumbnail: "t" }])));
      const before = Date.now();
      const res = await request(app).get(
        "/api/bgg/coleccion/charlie?refresh=1",
      );
      expect(res.status).toBe(200);
      const u = await User.findOne({ bggUsername: "charlie" }).lean();
      const stamp = u.bggSync?.lastManualRefreshColeccionAt;
      expect(stamp).toBeTruthy();
      expect(new Date(stamp).getTime()).toBeGreaterThanOrEqual(before);
    });

    it("after cooldown elapses (timestamp aged), a refresh succeeds again", async () => {
      await createUser({ bggUsername: "diana" });
      // Set a stamp that's already older than the 60s window.
      await User.updateOne(
        { bggUsername: "diana" },
        {
          $set: {
            "bggSync.lastManualRefreshColeccionAt": new Date(
              Date.now() - 65 * 1000,
            ),
          },
        },
      );
      fetchSpy.mockResolvedValueOnce(ok(collectionXml([{ id: "1", name: "G", thumbnail: "t" }])));
      const res = await request(app).get(
        "/api/bgg/coleccion/diana?refresh=1",
      );
      expect(res.status).toBe(200);
    });

    it("anon (no Turnocero User owns the bggUsername) → refresh is allowed without persistence", async () => {
      // No user created with bggUsername "anon".
      fetchSpy.mockResolvedValueOnce(ok(collectionXml([{ id: "1", name: "G", thumbnail: "t" }])));
      const res = await request(app).get("/api/bgg/coleccion/anon?refresh=1");
      expect(res.status).toBe(200);
      // Header reads as 0 because there's no User to track against.
      expect(Number(res.headers["x-refresh-cooldown-ms"])).toBe(0);
    });

    it("is case-insensitive against User.bggUsername (case-preserved)", async () => {
      await createUser({ bggUsername: "Alice" }); // case-preserved
      fetchSpy.mockResolvedValueOnce(ok(collectionXml([{ id: "1", name: "G", thumbnail: "t" }])));
      // Request the lowercase variant — should still stamp the same User.
      const res = await request(app).get("/api/bgg/coleccion/alice?refresh=1");
      expect(res.status).toBe(200);
      const u = await User.findOne({ bggUsername: "Alice" }).lean();
      expect(u.bggSync?.lastManualRefreshColeccionAt).toBeTruthy();
    });
  });

  // ── /partidas ────────────────────────────────────────────────────
  describe("GET /api/bgg/partidas/:user", () => {
    it("first ?refresh=1 succeeds, second within the window is 429", async () => {
      const user = await createUser({ bggUsername: "evan" });
      // Pre-seed BggPlay so we go down the Mongo-served path (no BGG fetch
      // is strictly required for the response, but probe() fires once on
      // refresh and we have to mock that).
      await BggPlay.create({
        bggUsername: "evan",
        playId: "1",
        gameId: "100",
        date: "2026-01-01",
        players: [],
        hash: "h",
      });
      // probe() fires fetch — return an empty plays page.
      fetchSpy.mockResolvedValue(ok(playsXml([], 0)));

      const r1 = await request(app).get("/api/bgg/partidas/evan?refresh=1");
      expect(r1.status).toBe(200);
      expect(Number(r1.headers["x-refresh-cooldown-ms"])).toBeGreaterThan(0);

      const r2 = await request(app).get("/api/bgg/partidas/evan?refresh=1");
      expect(r2.status).toBe(429);
      expect(r2.body.retryAfterMs).toBeGreaterThan(0);

      // Suppress unused-var warning; user fixture exists for setup completeness.
      expect(user.bggUsername).toBe("evan");
    });

    it("stamps lastManualRefreshPartidasAt — independent of coleccion stamp", async () => {
      await createUser({ bggUsername: "fiona" });
      await BggPlay.create({
        bggUsername: "fiona",
        playId: "1",
        gameId: "100",
        date: "2026-01-01",
        players: [],
        hash: "h",
      });
      fetchSpy.mockResolvedValue(ok(playsXml([], 0)));

      const res = await request(app).get(
        "/api/bgg/partidas/fiona?refresh=1",
      );
      expect(res.status).toBe(200);

      const u = await User.findOne({ bggUsername: "fiona" }).lean();
      expect(u.bggSync?.lastManualRefreshPartidasAt).toBeTruthy();
      // The OTHER panel's stamp must NOT be touched.
      expect(u.bggSync?.lastManualRefreshColeccionAt).toBeFalsy();
    });

    it("partidas cooldown does NOT block coleccion refresh (independent windows)", async () => {
      await createUser({ bggUsername: "gabe" });
      await BggPlay.create({
        bggUsername: "gabe",
        playId: "1",
        gameId: "100",
        date: "2026-01-01",
        players: [],
        hash: "h",
      });
      // Fire partidas refresh first.
      fetchSpy.mockResolvedValueOnce(ok(playsXml([], 0))); // probe
      const r1 = await request(app).get("/api/bgg/partidas/gabe?refresh=1");
      expect(r1.status).toBe(200);

      // Now immediately refresh coleccion — should pass.
      fetchSpy.mockResolvedValueOnce(ok(collectionXml([{ id: "1", name: "G", thumbnail: "t" }])));
      const r2 = await request(app).get("/api/bgg/coleccion/gabe?refresh=1");
      expect(r2.status).toBe(200);
    });

    it("non-refresh GET to /partidas exposes the cooldown header but never stamps", async () => {
      await createUser({ bggUsername: "hank" });
      await BggPlay.create({
        bggUsername: "hank",
        playId: "1",
        gameId: "100",
        date: "2026-01-01",
        players: [],
        hash: "h",
      });

      const res = await request(app).get("/api/bgg/partidas/hank");
      expect(res.status).toBe(200);
      expect(res.headers["x-refresh-cooldown-ms"]).toBeDefined();
      // No stamp because no refresh.
      const u = await User.findOne({ bggUsername: "hank" }).lean();
      expect(u.bggSync?.lastManualRefreshPartidasAt).toBeFalsy();
    });
  });
});
