const request = require("supertest");
const app = require("../../app");
const BggGame = require("../../models/BggGame");
const BggCollection = require("../../models/BggCollection");
const BggPlay = require("../../models/BggPlay");
const User = require("../../models/User");
const { createAuthedUser } = require("../helpers/auth");
const bggRouter = require("../../routes/bgg");

// ── Fixtures ─────────────────────────────────────────────────────────
function thingXml(games) {
  const items = games
    .map(
      (g) => `
    <item type="boardgame" id="${g.id}">
      <thumbnail>${g.thumbnail || ""}</thumbnail>
      <image>${g.image || ""}</image>
      <name type="primary" sortindex="1" value="${g.name}"/>
      <yearpublished value="${g.year || 0}"/>
      <minplayers value="${g.minPlayers || 0}"/>
      <maxplayers value="${g.maxPlayers || 0}"/>
    </item>
  `,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><items>${items}</items>`;
}

function emptyThingXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><items></items>`;
}

function searchXml(games) {
  const items = games
    .map(
      (g) => `
    <item type="boardgame" id="${g.id}">
      <name type="primary" value="${g.name}"/>
      <yearpublished value="${g.year || 0}"/>
    </item>
  `,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><items total="${games.length}">${items}</items>`;
}

function playsXml(plays, total) {
  const playsContent = plays
    .map(
      (p) => `
    <play id="${p.id}" date="${p.date}" quantity="1" length="60" incomplete="0" nowinstats="0" location="">
      <item name="${p.gameName}" objecttype="thing" objectid="${p.gameId}"/>
      <players><player username="" name="Solo" startposition="" color="" score="" rating="0" new="0" win="1"/></players>
    </play>
  `,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><plays username="user" userid="1" total="${total ?? plays.length}" page="1">${playsContent}</plays>`;
}

function ok(body) {
  return { ok: true, status: 200, text: async () => body };
}

// ── Suite ────────────────────────────────────────────────────────────
describe("BGG persistent cache (memoria → Mongo → BGG)", () => {
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

  // ── GET /api/bgg/game/:id ─────────────────────────────────────────
  describe("GET /api/bgg/game/:id", () => {
    it("cold path: empty Mongo → calls BGG once and persists the game", async () => {
      fetchSpy.mockResolvedValueOnce(
        ok(
          thingXml([
            {
              id: 1001,
              name: "Catan",
              thumbnail: "t1",
              image: "i1",
              year: 1995,
              minPlayers: 3,
              maxPlayers: 4,
            },
          ]),
        ),
      );

      const res = await request(app).get("/api/bgg/game/1001");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 1001,
        name: "Catan",
        thumbnail: "t1",
        image: "i1",
        year: 1995,
        minPlayers: 3,
        maxPlayers: 4,
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const persisted = await BggGame.findOne({ gameId: 1001 }).lean();
      expect(persisted).toBeTruthy();
      expect(persisted.name).toBe("Catan");
      expect(persisted.thumbnail).toBe("t1");
    });

    it("warm path: game already in Mongo → does NOT call BGG", async () => {
      await BggGame.create({
        gameId: 1002,
        name: "Cached",
        thumbnail: "t2",
        image: "i2",
        yearPublished: 2000,
        minPlayers: 2,
        maxPlayers: 5,
      });

      const res = await request(app).get("/api/bgg/game/1002");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 1002,
        name: "Cached",
        thumbnail: "t2",
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("404 when BGG returns no item for an unknown id", async () => {
      fetchSpy.mockResolvedValueOnce(ok(emptyThingXml()));
      const res = await request(app).get("/api/bgg/game/9999");
      expect(res.status).toBe(404);
    });

    it("502 when BGG fails with a non-404 error", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "",
      });
      const res = await request(app).get("/api/bgg/game/1003");
      expect(res.status).toBe(502);
    });

    it("400 on invalid id", async () => {
      const res = await request(app).get("/api/bgg/game/abc");
      expect(res.status).toBe(400);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // ── GET /api/bgg/partidas/:user — enrichment ─────────────────────
  describe("GET /api/bgg/partidas/:bggUsername", () => {
    it("cold: fetches /plays + batch /thing, then persists every game", async () => {
      fetchSpy
        .mockResolvedValueOnce(
          ok(
            playsXml([
              {
                id: "101",
                date: "2026-01-01",
                gameName: "Catan",
                gameId: 2001,
              },
              {
                id: "102",
                date: "2026-01-02",
                gameName: "Wingspan",
                gameId: 2002,
              },
            ]),
          ),
        )
        .mockResolvedValueOnce(
          ok(
            thingXml([
              { id: 2001, name: "Catan", thumbnail: "catan.jpg" },
              { id: 2002, name: "Wingspan", thumbnail: "wing.jpg" },
            ]),
          ),
        );

      const res = await request(app).get("/api/bgg/partidas/someuser");
      expect(res.status).toBe(200);
      expect(res.body.plays).toHaveLength(2);
      expect(res.body.plays[0].gameThumbnail).toBe("catan.jpg");
      expect(res.body.plays[1].gameThumbnail).toBe("wing.jpg");

      // Both games were persisted.
      const count = await BggGame.countDocuments({
        gameId: { $in: [2001, 2002] },
      });
      expect(count).toBe(2);
      expect(fetchSpy).toHaveBeenCalledTimes(2); // 1 plays + 1 batch thing
    });

    it("mixed: some games already cached in Mongo → BGG /thing only requested for the missing ones", async () => {
      // Pre-populate one of the two games in Mongo.
      await BggGame.create({
        gameId: 3001,
        name: "Already",
        thumbnail: "already.jpg",
      });

      fetchSpy
        .mockResolvedValueOnce(
          ok(
            playsXml([
              {
                id: "201",
                date: "2026-02-01",
                gameName: "Already",
                gameId: 3001,
              },
              {
                id: "202",
                date: "2026-02-02",
                gameName: "NewGame",
                gameId: 3002,
              },
            ]),
          ),
        )
        .mockResolvedValueOnce(
          ok(thingXml([{ id: 3002, name: "NewGame", thumbnail: "new.jpg" }])),
        );

      const res = await request(app).get("/api/bgg/partidas/mixeduser");
      expect(res.status).toBe(200);
      expect(res.body.plays[0].gameThumbnail).toBe("already.jpg");
      expect(res.body.plays[1].gameThumbnail).toBe("new.jpg");

      // The /thing call URL should only contain the missing id (3002), not 3001.
      const thingCallUrl = fetchSpy.mock.calls[1][0];
      expect(thingCallUrl).toContain("id=3002");
      expect(thingCallUrl).not.toContain("3001");
    });

    it("warm: all games already in Mongo → BGG /thing is NOT called at all", async () => {
      await BggGame.create({ gameId: 4001, name: "W1", thumbnail: "w1.jpg" });
      await BggGame.create({ gameId: 4002, name: "W2", thumbnail: "w2.jpg" });

      fetchSpy.mockResolvedValueOnce(
        ok(
          playsXml([
            { id: "301", date: "2026-03-01", gameName: "W1", gameId: 4001 },
            { id: "302", date: "2026-03-02", gameName: "W2", gameId: 4002 },
          ]),
        ),
      );

      const res = await request(app).get("/api/bgg/partidas/warmuser");
      expect(res.status).toBe(200);
      expect(res.body.plays[0].gameThumbnail).toBe("w1.jpg");
      expect(res.body.plays[1].gameThumbnail).toBe("w2.jpg");

      // Only ONE call to fetch — the /plays endpoint. NOT a second call to /thing.
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toContain("/plays");
    });

    it("shared across users: user A populates the cache, user B reuses it", async () => {
      // User A — cold path, populates Mongo.
      fetchSpy
        .mockResolvedValueOnce(
          ok(
            playsXml([
              {
                id: "401",
                date: "2026-04-01",
                gameName: "Shared",
                gameId: 5001,
              },
            ]),
          ),
        )
        .mockResolvedValueOnce(
          ok(thingXml([{ id: 5001, name: "Shared", thumbnail: "shared.jpg" }])),
        );
      await request(app).get("/api/bgg/partidas/userA");
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Reset only the in-memory L1 cache (simulating a server restart),
      // and the /plays call for user B should still NOT trigger a /thing
      // call because Mongo already has the game.
      bggRouter.__resetCache();
      fetchSpy.mockClear();
      fetchSpy.mockResolvedValueOnce(
        ok(
          playsXml([
            { id: "402", date: "2026-04-02", gameName: "Shared", gameId: 5001 },
          ]),
        ),
      );

      const res = await request(app).get("/api/bgg/partidas/userB");
      expect(res.status).toBe(200);
      expect(res.body.plays[0].gameThumbnail).toBe("shared.jpg");
      expect(fetchSpy).toHaveBeenCalledTimes(1); // only /plays for user B
    });
  });

  // ── POST /api/bgg/sync (full play sync) ──────────────────────────
  describe("POST /api/bgg/sync", () => {
    it("401 when unauthenticated", async () => {
      const res = await request(app).post("/api/bgg/sync");
      expect(res.status).toBe(401);
    });

    it("400 when the user has no bggUsername", async () => {
      const { token } = await createAuthedUser({ bggUsername: "" });
      const res = await request(app)
        .post("/api/bgg/sync")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it("persists every play to Mongo and stamps User.bggSync", async () => {
      const { token, user } = await createAuthedUser({
        bggUsername: "syncuser",
      });
      fetchSpy
        // page=1 returns 2 plays with total=2 → loop exits after this page
        .mockResolvedValueOnce(
          ok(
            playsXml(
              [
                { id: "1", date: "2026-01-01", gameName: "A", gameId: 1 },
                { id: "2", date: "2026-01-02", gameName: "B", gameId: 2 },
              ],
              2,
            ),
          ),
        )
        // game-thumbnail batch
        .mockResolvedValueOnce(
          ok(
            thingXml([
              { id: 1, name: "A", thumbnail: "a.jpg" },
              { id: 2, name: "B", thumbnail: "b.jpg" },
            ]),
          ),
        );

      const res = await request(app)
        .post("/api/bgg/sync")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.inserted).toBe(2);
      expect(res.body.updated).toBe(0);
      expect(res.body.deleted).toBe(0);
      expect(res.body.total).toBe(2);
      expect(res.body.lastFullSyncAt).toBeTruthy();

      const docs = await BggPlay.find({ bggUsername: "syncuser" })
        .sort({ playId: 1 })
        .lean();
      expect(docs).toHaveLength(2);
      expect(docs[0].gameThumbnail).toBe("a.jpg");
      expect(docs[1].gameThumbnail).toBe("b.jpg");
      // Every persisted play has a hash for drift detection.
      expect(docs[0].hash).toMatch(/^[0-9a-f]{40}$/);
      expect(docs[1].hash).toMatch(/^[0-9a-f]{40}$/);

      const persisted = await User.findById(user._id).lean();
      expect(persisted.bggSync.lastFullSyncAt).toBeTruthy();
      expect(persisted.bggSync.lastFullSyncCount).toBe(2);
    });

    it("deletes local plays that no longer exist on BGG (full reconcile)", async () => {
      const { token } = await createAuthedUser({ bggUsername: "rewriter" });
      // Stale doc: present locally, BGG no longer returns it → must be deleted.
      await BggPlay.create({
        bggUsername: "rewriter",
        playId: "999",
        date: "2020-01-01",
        gameId: "99",
      });

      fetchSpy
        .mockResolvedValueOnce(
          ok(
            playsXml(
              [{ id: "1", date: "2026-01-01", gameName: "New", gameId: 1 }],
              1,
            ),
          ),
        )
        .mockResolvedValueOnce(
          ok(thingXml([{ id: 1, name: "New", thumbnail: "n.jpg" }])),
        );

      const res = await request(app)
        .post("/api/bgg/sync")
        .set("Authorization", `Bearer ${token}`);
      expect(res.body.deleted).toBe(1);

      const docs = await BggPlay.find({ bggUsername: "rewriter" }).lean();
      expect(docs).toHaveLength(1);
      expect(docs[0].playId).toBe("1");
    });

    it("is idempotent: running twice with no BGG changes is a no-op the second time", async () => {
      const { token } = await createAuthedUser({ bggUsername: "idem" });

      const setup = () => {
        fetchSpy
          .mockResolvedValueOnce(
            ok(
              playsXml(
                [{ id: "1", date: "2026-01-01", gameName: "A", gameId: 1 }],
                1,
              ),
            ),
          )
          .mockResolvedValueOnce(
            ok(thingXml([{ id: 1, name: "A", thumbnail: "a.jpg" }])),
          );
      };

      setup();
      const first = await request(app)
        .post("/api/bgg/sync")
        .set("Authorization", `Bearer ${token}`);
      expect(first.body.inserted).toBe(1);

      // BggGame is now cached → only the /plays request will hit fetchSpy
      // on the second run.
      fetchSpy.mockResolvedValueOnce(
        ok(
          playsXml(
            [{ id: "1", date: "2026-01-01", gameName: "A", gameId: 1 }],
            1,
          ),
        ),
      );

      const second = await request(app)
        .post("/api/bgg/sync")
        .set("Authorization", `Bearer ${token}`);
      expect(second.body.inserted).toBe(0);
      expect(second.body.updated).toBe(0);
      expect(second.body.deleted).toBe(0);
      expect(second.body.total).toBe(1);
    });

    it("detects edits via hash: same playId with different content is updated", async () => {
      const { token } = await createAuthedUser({ bggUsername: "edituser" });
      // Seed with a play whose hash will NOT match what BGG returns.
      await BggPlay.create({
        bggUsername: "edituser",
        playId: "1",
        date: "2026-01-01",
        gameId: "1",
        gameName: "Old Name",
        comments: "stale comment",
        hash: "stale-hash-that-wont-match",
      });

      fetchSpy
        .mockResolvedValueOnce(
          ok(
            playsXml(
              [{ id: "1", date: "2026-01-01", gameName: "A", gameId: 1 }],
              1,
            ),
          ),
        )
        .mockResolvedValueOnce(
          ok(thingXml([{ id: 1, name: "A", thumbnail: "a.jpg" }])),
        );

      const res = await request(app)
        .post("/api/bgg/sync")
        .set("Authorization", `Bearer ${token}`);
      expect(res.body.inserted).toBe(0);
      expect(res.body.updated).toBe(1);
      expect(res.body.deleted).toBe(0);

      const doc = await BggPlay.findOne({
        bggUsername: "edituser",
        playId: "1",
      }).lean();
      expect(doc.gameName).toBe("A");
      expect(doc.comments).toBeNull(); // overwritten by the BGG response
      expect(doc.hash).not.toBe("stale-hash-that-wont-match");
    });

    it("does not wipe data if BGG fails mid-walk", async () => {
      const { token } = await createAuthedUser({ bggUsername: "failsafe" });
      // Pre-existing play that should survive a failed reconcile.
      await BggPlay.create({
        bggUsername: "failsafe",
        playId: "7",
        date: "2025-12-01",
        gameId: "7",
        hash: "x",
      });

      fetchSpy.mockRejectedValueOnce(new Error("BGG down"));

      const res = await request(app)
        .post("/api/bgg/sync")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(502);

      const docs = await BggPlay.find({ bggUsername: "failsafe" }).lean();
      expect(docs).toHaveLength(1);
      expect(docs[0].playId).toBe("7");
    });

    it("stamps bggSync via the probe path regardless of bggUsername casing", async () => {
      // User stores bggUsername with mixed case (legitimate — bggUsername
      // is case-preserved). BggPlay normalizes to lowercase internally.
      // stampProbeOutcome / stampReconcileResult must match the User
      // case-insensitively or the update silently no-ops, leaving
      // bggSync.lastProbedAt null forever.
      const { user } = await createAuthedUser({ bggUsername: "MixedCase" });
      await BggPlay.create({
        bggUsername: "mixedcase",
        playId: "1",
        date: "2026-01-01",
        gameId: "13",
        hash: "h",
      });

      // ?refresh=1 → sync probe path → calls stampProbeOutcome.
      // BGG returns same playId same content → no_drift, no further fetch.
      const { computePlayHash } = require("../../utils/bggHash");
      // Trigger a count-drift so reconcileFull runs and stamps via reconcile flow.
      fetchSpy
        .mockResolvedValueOnce(
          ok(
            playsXml(
              [
                { id: "1", date: "2026-01-01", gameName: "A", gameId: 13 },
                { id: "2", date: "2026-01-02", gameName: "B", gameId: 14 },
              ],
              2,
            ),
          ),
        )
        .mockResolvedValueOnce(
          ok(
            playsXml(
              [
                { id: "1", date: "2026-01-01", gameName: "A", gameId: 13 },
                { id: "2", date: "2026-01-02", gameName: "B", gameId: 14 },
              ],
              2,
            ),
          ),
        )
        .mockResolvedValueOnce(
          ok(
            thingXml([
              { id: 13, name: "A", thumbnail: "t.jpg" },
              { id: 14, name: "B", thumbnail: "t2.jpg" },
            ]),
          ),
        );

      // Pass mixed-case in URL too — the route lowercases internally.
      await request(app).get("/api/bgg/partidas/MixedCase?refresh=1");

      const u = await User.findById(user._id).lean();
      expect(u.bggSync?.lastProbedAt).toBeTruthy();
      expect(u.bggSync?.lastProbeOutcome).toBe("reconciled");
      void computePlayHash; // suppress unused
    });
  });

  // ── GET /partidas with Mongo data (Phase 3 path) ─────────────────
  describe("GET /partidas — Mongo-served path", () => {
    it("serves from Mongo when records exist and never touches BGG", async () => {
      await BggPlay.insertMany([
        {
          bggUsername: "mongo1",
          playId: "1",
          date: "2026-05-01",
          gameName: "X",
          gameId: "13",
          gameThumbnail: "x.jpg",
        },
        {
          bggUsername: "mongo1",
          playId: "2",
          date: "2026-05-02",
          gameName: "Y",
          gameId: "14",
          gameThumbnail: "y.jpg",
        },
      ]);

      const res = await request(app).get("/api/bgg/partidas/mongo1");
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.plays).toHaveLength(2);
      // sorted by date desc → '2' (2026-05-02) first
      expect(res.body.plays[0].id).toBe("2");
      expect(res.body.plays[0].gameThumbnail).toBe("y.jpg");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("applies mindate / maxdate / gameId filters as Mongo queries", async () => {
      await BggPlay.insertMany([
        {
          bggUsername: "mongo2",
          playId: "1",
          date: "2026-01-01",
          gameId: "13",
        },
        {
          bggUsername: "mongo2",
          playId: "2",
          date: "2026-05-01",
          gameId: "13",
        },
        {
          bggUsername: "mongo2",
          playId: "3",
          date: "2026-05-02",
          gameId: "14",
        },
      ]);

      const res = await request(app).get(
        "/api/bgg/partidas/mongo2?mindate=2026-04-01&id=13",
      );
      expect(res.status).toBe(200);
      expect(res.body.plays).toHaveLength(1);
      expect(res.body.plays[0].id).toBe("2");
    });

    it("paginates Mongo results 10 per page", async () => {
      const docs = [];
      for (let i = 1; i <= 15; i++) {
        docs.push({
          bggUsername: "mongo3",
          playId: String(i),
          date: `2026-05-${String(i).padStart(2, "0")}`,
          gameId: "13",
        });
      }
      await BggPlay.insertMany(docs);

      const p1 = await request(app).get("/api/bgg/partidas/mongo3?page=1");
      expect(p1.body.total).toBe(15);
      expect(p1.body.plays).toHaveLength(10);
      // newest first
      expect(p1.body.plays[0].id).toBe("15");

      const p2 = await request(app).get("/api/bgg/partidas/mongo3?page=2");
      expect(p2.body.plays).toHaveLength(5);
      expect(p2.body.plays[0].id).toBe("5");
    });

    it("falls back to BGG when no Mongo records exist", async () => {
      fetchSpy
        .mockResolvedValueOnce(
          ok(
            playsXml([
              { id: "1", date: "2026-01-01", gameName: "X", gameId: 1 },
            ]),
          ),
        )
        .mockResolvedValueOnce(
          ok(thingXml([{ id: 1, name: "X", thumbnail: "t.jpg" }])),
        );

      const res = await request(app).get("/api/bgg/partidas/never-synced");
      expect(res.status).toBe(200);
      expect(res.body.plays).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("includes topGame (from BggPlay aggregation) on unfiltered page=1", async () => {
      await BggPlay.insertMany([
        {
          bggUsername: "topagg",
          playId: "1",
          date: "2026-05-01",
          gameId: "13",
          gameName: "A",
          gameThumbnail: "a.jpg",
          quantity: 1,
        },
        {
          bggUsername: "topagg",
          playId: "2",
          date: "2026-05-02",
          gameId: "13",
          gameName: "A",
          gameThumbnail: "a.jpg",
          quantity: 2,
        },
        {
          bggUsername: "topagg",
          playId: "3",
          date: "2026-05-03",
          gameId: "14",
          gameName: "B",
          gameThumbnail: "b.jpg",
          quantity: 1,
        },
      ]);

      const res = await request(app).get("/api/bgg/partidas/topagg");
      expect(res.status).toBe(200);
      expect(res.body.topGame).toEqual({
        id: "13",
        name: "A",
        thumbnail: "a.jpg",
        numPlays: 3, // 1 + 2 (quantity summed)
      });
    });

    it("omits topGame on filtered or paginated requests", async () => {
      await BggPlay.insertMany([
        {
          bggUsername: "topagg2",
          playId: "1",
          date: "2026-05-01",
          gameId: "13",
          gameName: "A",
        },
      ]);

      const filtered = await request(app).get(
        "/api/bgg/partidas/topagg2?mindate=2026-04-01",
      );
      expect(filtered.body).not.toHaveProperty("topGame");

      const page2 = await request(app).get("/api/bgg/partidas/topagg2?page=2");
      expect(page2.body).not.toHaveProperty("topGame");
    });

    it("includes gameStats when filtered by ?id=<gameId>", async () => {
      // 4 plays of game 13 for owner 'gs1':
      //   - playId 1: owner present, win=true, duration 60
      //   - playId 2: owner present, win=false, duration 90
      //   - playId 3: owner present, win=true, duration 0 (excluded from avg)
      //   - playId 4: NO owner-matching player (different username) → excluded from rated
      // Plus 1 unrelated play of game 14 to make sure it's filtered out.
      await BggPlay.insertMany([
        {
          bggUsername: "gs1",
          playId: "1",
          date: "2026-05-01",
          gameId: "13",
          duration: 60,
          players: [{ username: "gs1", win: true }],
        },
        {
          bggUsername: "gs1",
          playId: "2",
          date: "2026-05-10",
          gameId: "13",
          duration: 90,
          players: [
            { username: "gs1", win: false },
            { username: "other", win: true },
          ],
        },
        {
          bggUsername: "gs1",
          playId: "3",
          date: "2026-05-15",
          gameId: "13",
          duration: 0,
          players: [{ username: "Gs1", win: true }], // case-insensitive owner match
        },
        {
          bggUsername: "gs1",
          playId: "4",
          date: "2026-05-20",
          gameId: "13",
          duration: 30,
          players: [{ username: "someoneelse", win: false }], // no owner match
        },
        {
          bggUsername: "gs1",
          playId: "5",
          date: "2026-05-25",
          gameId: "14",
          duration: 120,
          players: [{ username: "gs1", win: true }],
        },
      ]);

      const res = await request(app).get("/api/bgg/partidas/gs1?id=13");
      expect(res.status).toBe(200);
      expect(res.body.gameStats).toBeDefined();
      expect(res.body.gameStats.wins).toBe(2); // plays 1 and 3 (owner-win)
      expect(res.body.gameStats.rated).toBe(3); // plays 1, 2, 3 (4 has no owner-matching player)
      // avgDuration averages duration > 0 across ALL plays of this game
      // (owner identification only filters wins/rated, not duration).
      expect(res.body.gameStats.avgDuration).toBe(60); // (60 + 90 + 30) / 3 — play 3's 0 excluded
      expect(res.body.gameStats.lastDate).toBe("2026-05-20");
    });

    it("omits gameStats when no gameId filter is applied", async () => {
      await BggPlay.insertMany([
        { bggUsername: "gs2", playId: "1", date: "2026-05-01", gameId: "13" },
      ]);
      const res = await request(app).get("/api/bgg/partidas/gs2");
      expect(res.body).not.toHaveProperty("gameStats");
    });

    it("gameStats returns zeros when no plays of that game exist locally", async () => {
      await BggPlay.insertMany([
        { bggUsername: "gs3", playId: "1", date: "2026-05-01", gameId: "99" },
      ]);
      const res = await request(app).get("/api/bgg/partidas/gs3?id=13");
      expect(res.body.gameStats).toEqual({
        wins: 0,
        rated: 0,
        avgDuration: null,
        lastDate: null,
      });
    });

    it("returns topGame: null when user has no plays with a gameId", async () => {
      await BggPlay.insertMany([
        {
          bggUsername: "noid",
          playId: "1",
          date: "2026-05-01",
          gameId: null,
          gameName: "unknown",
        },
      ]);

      const res = await request(app).get("/api/bgg/partidas/noid");
      expect(res.body.topGame).toBeNull();
    });

    it("?refresh=1 with no drift: 1 BGG request, no Mongo writes, outcome no_drift", async () => {
      // Seed by doing a real sync first so the stored hash exactly matches
      // what parsePlaysXml + computePlayHash will produce on the probe.
      const { token, user } = await createAuthedUser({
        bggUsername: "nodrift",
      });
      const seedXml = ok(
        playsXml(
          [{ id: "1", date: "2026-05-01", gameName: "Old", gameId: 13 }],
          1,
        ),
      );
      fetchSpy
        .mockResolvedValueOnce(seedXml)
        .mockResolvedValueOnce(
          ok(thingXml([{ id: 13, name: "X", thumbnail: "t.jpg" }])),
        );
      await request(app)
        .post("/api/bgg/sync")
        .set("Authorization", `Bearer ${token}`);
      expect(await BggPlay.countDocuments({ bggUsername: "nodrift" })).toBe(1);
      const callsAfterSeed = fetchSpy.mock.calls.length;

      // Probe: BGG returns same single play with same content → no drift.
      fetchSpy.mockResolvedValueOnce(seedXml);
      const res = await request(app).get("/api/bgg/partidas/nodrift?refresh=1");
      expect(res.status).toBe(200);
      expect(fetchSpy.mock.calls.length).toBe(callsAfterSeed + 1); // exactly 1 new fetch
      expect(await BggPlay.countDocuments({ bggUsername: "nodrift" })).toBe(1);

      const u = await User.findById(user._id).lean();
      expect(u.bggSync.lastProbeOutcome).toBe("no_drift");
      expect(u.bggSync.lastProbedAt).toBeTruthy();
    });

    it("?refresh=1 with edits to recent plays: upserts and stamps edits_only", async () => {
      const { user } = await createAuthedUser({ bggUsername: "editor" });
      // Local play with a stale hash that won't match BGG's response.
      await BggPlay.create({
        bggUsername: "editor",
        playId: "1",
        date: "2026-05-01",
        gameId: "13",
        gameName: "Stale",
        hash: "stale-hash-wont-match",
      });

      // Same total (1), same playId, but different content (hash mismatch).
      fetchSpy
        .mockResolvedValueOnce(
          ok(
            playsXml(
              [{ id: "1", date: "2026-05-01", gameName: "Edited", gameId: 13 }],
              1,
            ),
          ),
        )
        .mockResolvedValueOnce(
          ok(thingXml([{ id: 13, name: "Edited", thumbnail: "t.jpg" }])),
        );

      await request(app).get("/api/bgg/partidas/editor?refresh=1");

      const doc = await BggPlay.findOne({
        bggUsername: "editor",
        playId: "1",
      }).lean();
      expect(doc.gameName).toBe("Edited");
      expect(doc.hash).not.toBe("stale-hash-wont-match");

      const u = await User.findById(user._id).lean();
      expect(u.bggSync.lastProbeOutcome).toBe("edits_only");
    });

    it("?refresh=1 with total drift (add): triggers reconcile and stamps reconciled", async () => {
      const { user } = await createAuthedUser({ bggUsername: "addedplay" });
      await BggPlay.create({
        bggUsername: "addedplay",
        playId: "1",
        date: "2026-05-01",
        gameId: "13",
        hash: "h1",
      });

      // Probe sees total=2 vs local count=1 → delegates to reconcileFull,
      // which re-fetches page 1.
      const playsResponse = ok(
        playsXml(
          [
            { id: "1", date: "2026-05-01", gameName: "Old", gameId: 13 },
            { id: "2", date: "2026-05-05", gameName: "New", gameId: 13 },
          ],
          2,
        ),
      );
      fetchSpy
        .mockResolvedValueOnce(playsResponse) // probe
        .mockResolvedValueOnce(playsResponse) // reconcile page 1
        .mockResolvedValueOnce(
          ok(thingXml([{ id: 13, name: "X", thumbnail: "t.jpg" }])),
        );

      await request(app).get("/api/bgg/partidas/addedplay?refresh=1");

      expect(await BggPlay.countDocuments({ bggUsername: "addedplay" })).toBe(
        2,
      );
      const u = await User.findById(user._id).lean();
      expect(u.bggSync.lastProbeOutcome).toBe("reconciled");
    });

    it("?refresh=1 with BGG failure: stamps failed, no writes", async () => {
      const { user } = await createAuthedUser({ bggUsername: "oops" });
      await BggPlay.create({
        bggUsername: "oops",
        playId: "1",
        date: "2026-05-01",
        gameId: "13",
        hash: "h",
      });

      fetchSpy.mockRejectedValueOnce(new Error("BGG offline"));

      const res = await request(app).get("/api/bgg/partidas/oops?refresh=1");
      // Probe failure does NOT fail the response — we still serve from Mongo.
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);

      const u = await User.findById(user._id).lean();
      expect(u.bggSync.lastProbeOutcome).toBe("failed");
    });

    it("GET without refresh and recent lastProbedAt skips the background probe", async () => {
      const { user } = await createAuthedUser({ bggUsername: "recent" });
      // createAuthedUser doesn't accept bggSync overrides — stamp it directly.
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            "bggSync.lastProbedAt": new Date(),
            "bggSync.lastProbeOutcome": "no_drift",
            "bggSync.lastFullSyncAt": new Date(), // not overdue
          },
        },
      );
      await BggPlay.create({
        bggUsername: "recent",
        playId: "1",
        date: "2026-05-01",
        gameId: "13",
        hash: "h",
      });

      const res = await request(app).get("/api/bgg/partidas/recent");
      expect(res.status).toBe(200);
      // No BGG fetch — background probe was throttled.
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("dueño con lastFullSyncAt > 30 días: la visita (>3h) dispara el reconcile completo en background", async () => {
      const { user, token } = await createAuthedUser({
        bggUsername: "stalefull",
      });
      // Datos viejos (>3h) → probe sincrónico; lastFullSyncAt > 30d → además
      // dispara el reconcile completo en background.
      const longAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            "bggSync.lastProbedAt": longAgo,
            "bggSync.lastFullSyncAt": longAgo,
          },
        },
      );
      // Seed BggPlay so the Mongo-served path is taken.
      await BggPlay.create({
        bggUsername: "stalefull",
        playId: "1",
        date: "2026-01-01",
        gameId: "13",
        hash: "h",
      });

      // Tanto el probe sincrónico como el reconcile en background pegan a BGG;
      // ruteamos por URL para no depender del orden de consumo.
      const playsResponse = ok(
        playsXml(
          [{ id: "1", date: "2026-01-01", gameName: "A", gameId: 13 }],
          1,
        ),
      );
      const thingResponse = ok(
        thingXml([{ id: 13, name: "A", thumbnail: "t.jpg" }]),
      );
      fetchSpy.mockImplementation((url) => {
        if (url.includes("/plays")) return Promise.resolve(playsResponse);
        if (url.includes("/thing")) return Promise.resolve(thingResponse);
        return Promise.reject(new Error(`unexpected url: ${url}`));
      });

      const res = await request(app)
        .get("/api/bgg/partidas/stalefull")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);

      // The background reconcile fires after the response. Poll until it
      // stamps lastFullSyncAt with a recent value.
      const start = Date.now();
      let u;
      while (Date.now() - start < 3000) {
        u = await User.findById(user._id).lean();
        const t = u.bggSync?.lastFullSyncAt
          ? new Date(u.bggSync.lastFullSyncAt).getTime()
          : 0;
        if (t > longAgo.getTime() + 1000) break;
        await new Promise((r) => {
          setTimeout(r, 25);
        });
      }

      expect(u.bggSync.lastProbeOutcome).toBe("reconciled");
      expect(new Date(u.bggSync.lastFullSyncAt).getTime()).toBeGreaterThan(
        longAgo.getTime() + 1000,
      );
      expect(u.bggSync.lastFullSyncCount).toBe(1);
    });

    it("self-heals pre-Phase 5 users: GET fallback path triggers reconcile for User with no BggPlay", async () => {
      // User has a bggUsername (and credentials, like a pre-Phase 5 connect)
      // but no BggPlay records yet — falls into the L1/L3 path. The route
      // should kick off a background reconcile to populate BggPlay so
      // future visits use the Mongo-served path with gameStats etc.
      const { user } = await createAuthedUser({ bggUsername: "orphan" });
      expect(await BggPlay.countDocuments({ bggUsername: "orphan" })).toBe(0);

      // The L1/L3 path and the background reconcile both fetch from BGG
      // concurrently. Use mockImplementation with URL-based routing so the
      // order of consumption doesn't matter.
      const playsResponse = ok(
        playsXml(
          [{ id: "1", date: "2026-01-01", gameName: "A", gameId: 13 }],
          1,
        ),
      );
      const thingResponse = ok(
        thingXml([{ id: 13, name: "A", thumbnail: "t.jpg" }]),
      );
      fetchSpy.mockImplementation((url) => {
        if (url.includes("/plays")) return Promise.resolve(playsResponse);
        if (url.includes("/thing")) return Promise.resolve(thingResponse);
        return Promise.reject(new Error(`unexpected url: ${url}`));
      });

      const res = await request(app).get("/api/bgg/partidas/orphan");
      expect(res.status).toBe(200);

      // Poll until the background reconcile stamps the user.
      const start = Date.now();
      let u;
      while (Date.now() - start < 3000) {
        u = await User.findById(user._id).lean();
        if (u.bggSync?.lastFullSyncAt) break;
        await new Promise((r) => {
          setTimeout(r, 25);
        });
      }
      expect(u.bggSync?.lastFullSyncAt).toBeTruthy();
      expect(
        await BggPlay.countDocuments({ bggUsername: "orphan" }),
      ).toBeGreaterThan(0);
    });

    it("does NOT self-heal for a bggUsername with no Turnocero User (anon viewer case)", async () => {
      // No User in the DB — random anon visits /bg-watch/<stranger>.
      // Fallback serves from BGG XML but should NOT trigger a reconcile,
      // because there's no owner to attribute the sync to.
      fetchSpy
        .mockResolvedValueOnce(
          ok(
            playsXml(
              [{ id: "1", date: "2026-01-01", gameName: "A", gameId: 13 }],
              1,
            ),
          ),
        )
        .mockResolvedValueOnce(
          ok(thingXml([{ id: 13, name: "A", thumbnail: "t.jpg" }])),
        );

      const res = await request(app).get(
        "/api/bgg/partidas/strangerwithnoaccount",
      );
      expect(res.status).toBe(200);

      // Give any (incorrect) background work a moment to settle.
      await new Promise((r) => {
        setTimeout(r, 100);
      });
      // Only the L1/L3 fetches happened. No additional BGG calls from a
      // spurious reconcile.
      expect(fetchSpy.mock.calls.length).toBe(2);
      expect(
        await BggPlay.countDocuments({ bggUsername: "strangerwithnoaccount" }),
      ).toBe(0);
    });

    it("matches User case-insensitively when triggering the self-heal", async () => {
      // User has mixed-case bggUsername. Route passes lowercase to the
      // User lookup — would silently no-op without collation.
      const { user } = await createAuthedUser({ bggUsername: "MixedHealUser" });

      const playsResponse = ok(
        playsXml(
          [{ id: "1", date: "2026-01-01", gameName: "A", gameId: 13 }],
          1,
        ),
      );
      const thingResponse = ok(
        thingXml([{ id: 13, name: "A", thumbnail: "t.jpg" }]),
      );
      fetchSpy.mockImplementation((url) => {
        if (url.includes("/plays")) return Promise.resolve(playsResponse);
        if (url.includes("/thing")) return Promise.resolve(thingResponse);
        return Promise.reject(new Error(`unexpected url: ${url}`));
      });

      await request(app).get("/api/bgg/partidas/mixedhealuser"); // URL is lowercase

      const start = Date.now();
      let u;
      while (Date.now() - start < 3000) {
        u = await User.findById(user._id).lean();
        if (u.bggSync?.lastFullSyncAt) break;
        await new Promise((r) => {
          setTimeout(r, 25);
        });
      }
      expect(u.bggSync?.lastFullSyncAt).toBeTruthy();
    });

    it("POST /api/bgg/sync stamps lastProbedAt + lastProbeOutcome=reconciled", async () => {
      const { token, user } = await createAuthedUser({
        bggUsername: "stampcheck",
      });
      fetchSpy
        .mockResolvedValueOnce(
          ok(
            playsXml(
              [{ id: "1", date: "2026-01-01", gameName: "A", gameId: 13 }],
              1,
            ),
          ),
        )
        .mockResolvedValueOnce(
          ok(thingXml([{ id: 13, name: "A", thumbnail: "t.jpg" }])),
        );

      await request(app)
        .post("/api/bgg/sync")
        .set("Authorization", `Bearer ${token}`);

      const u = await User.findById(user._id).lean();
      expect(u.bggSync.lastFullSyncAt).toBeTruthy();
      expect(u.bggSync.lastProbedAt).toBeTruthy();
      expect(u.bggSync.lastProbeOutcome).toBe("reconciled");
    });
  });

  // ── GET /juegos-jugados/:bggUsername ─────────────────────────────
  describe("GET /api/bgg/juegos-jugados/:bggUsername", () => {
    it("returns games aggregated from BggPlay, sorted by numPlays desc", async () => {
      await BggPlay.insertMany([
        // game 13 → 3 plays total (sum of quantity: 1 + 2 = 3 from two docs)
        {
          bggUsername: "jj",
          playId: "1",
          date: "2026-01-01",
          gameId: "13",
          gameName: "Catán",
          gameThumbnail: "c.jpg",
          quantity: 1,
        },
        {
          bggUsername: "jj",
          playId: "2",
          date: "2026-02-01",
          gameId: "13",
          gameName: "Catán",
          gameThumbnail: "c.jpg",
          quantity: 2,
        },
        // game 14 → 5 plays (single doc)
        {
          bggUsername: "jj",
          playId: "3",
          date: "2026-03-01",
          gameId: "14",
          gameName: "Wingspan",
          gameThumbnail: "w.jpg",
          quantity: 5,
        },
        // game 15 → 1 play
        {
          bggUsername: "jj",
          playId: "4",
          date: "2026-04-01",
          gameId: "15",
          gameName: "Brass",
          gameThumbnail: "b.jpg",
          quantity: 1,
        },
        // play without gameId — excluded
        {
          bggUsername: "jj",
          playId: "5",
          date: "2026-05-01",
          gameId: null,
          gameName: "mystery",
          quantity: 1,
        },
      ]);

      const res = await request(app).get("/api/bgg/juegos-jugados/jj");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        { id: "14", name: "Wingspan", thumbnail: "w.jpg", numPlays: 5 },
        { id: "13", name: "Catán", thumbnail: "c.jpg", numPlays: 3 },
        { id: "15", name: "Brass", thumbnail: "b.jpg", numPlays: 1 },
      ]);
    });

    it("returns [] when the user has no BggPlay docs", async () => {
      const res = await request(app).get("/api/bgg/juegos-jugados/noplays");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("case-insensitive on the username (BggPlay stores lowercase)", async () => {
      await BggPlay.insertMany([
        {
          bggUsername: "mixedjj",
          playId: "1",
          date: "2026-01-01",
          gameId: "13",
          gameName: "A",
          quantity: 1,
        },
      ]);

      const res = await request(app).get("/api/bgg/juegos-jugados/MixedJJ");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe("13");
    });
  });

  // ── clearUserCache extended to BggPlay ───────────────────────────
  describe("clearUserCache also wipes BggPlay", () => {
    it("removes plays from the user", async () => {
      await BggPlay.insertMany([
        {
          bggUsername: "wipeme",
          playId: "1",
          date: "2026-01-01",
          gameId: "13",
        },
        {
          bggUsername: "wipeme",
          playId: "2",
          date: "2026-01-02",
          gameId: "13",
        },
      ]);
      expect(await BggPlay.countDocuments({ bggUsername: "wipeme" })).toBe(2);

      await bggRouter.clearUserCache("wipeme");

      expect(await BggPlay.countDocuments({ bggUsername: "wipeme" })).toBe(0);
    });
  });

  // ── BggCollection persistence (L2 in the cache chain) ────────────
  describe("BggCollection persistent cache", () => {
    function collectionXml(items) {
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

    it("cold path: empty Mongo → calls BGG once and persists the collection", async () => {
      fetchSpy.mockResolvedValueOnce(
        ok(
          collectionXml([
            {
              id: "101",
              name: "Alpha",
              thumbnail: "a.jpg",
              year: 2010,
              numPlays: 3,
            },
            {
              id: "102",
              name: "Beta",
              thumbnail: "b.jpg",
              year: 2011,
              numPlays: 1,
            },
          ]),
        ),
      );

      const res = await request(app).get("/api/bgg/coleccion/colduser");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const doc = await BggCollection.findOne({
        bggUsername: "colduser",
      }).lean();
      expect(doc).toBeTruthy();
      expect(doc.games).toHaveLength(2);
      expect(doc.games[0].name).toBe("Alpha");
    });

    it("warm L2 path: fresh Mongo doc serves the response without hitting BGG", async () => {
      await BggCollection.create({
        bggUsername: "warmuser",
        games: [{ id: "201", name: "Cached", thumbnail: "c.jpg", numPlays: 7 }],
      });
      // Clear L1 so we exercise L2 specifically
      bggRouter.__resetCache();

      const res = await request(app).get("/api/bgg/coleccion/warmuser");
      expect(res.status).toBe(200);
      expect(res.body[0].name).toBe("Cached");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("stale L2 path: expired Mongo doc → BGG called, doc updated", async () => {
      // Doc whose lastFetchedAt is 7 hours ago (> 6h TTL)
      await BggCollection.create({
        bggUsername: "staleuser",
        games: [{ id: "301", name: "Old", thumbnail: "old.jpg" }],
        lastFetchedAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
      });
      bggRouter.__resetCache();

      fetchSpy.mockResolvedValueOnce(
        ok(
          collectionXml([{ id: "301", name: "Updated", thumbnail: "new.jpg" }]),
        ),
      );

      const res = await request(app).get("/api/bgg/coleccion/staleuser");
      expect(res.status).toBe(200);
      expect(res.body[0].name).toBe("Updated");
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const doc = await BggCollection.findOne({
        bggUsername: "staleuser",
      }).lean();
      expect(doc.games[0].name).toBe("Updated");
      // lastFetchedAt was refreshed
      expect(Date.now() - doc.lastFetchedAt.getTime()).toBeLessThan(60_000);
    });

    it("?refresh=1 bypasses both L1 and L2 even with a fresh Mongo doc", async () => {
      await BggCollection.create({
        bggUsername: "refreshuser",
        games: [{ id: "401", name: "Old", thumbnail: "old.jpg" }],
      });
      bggRouter.__resetCache();

      fetchSpy.mockResolvedValueOnce(
        ok(
          collectionXml([
            { id: "401", name: "Forced", thumbnail: "forced.jpg" },
          ]),
        ),
      );

      const res = await request(app).get(
        "/api/bgg/coleccion/refreshuser?refresh=1",
      );
      expect(res.status).toBe(200);
      expect(res.body[0].name).toBe("Forced");
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const doc = await BggCollection.findOne({
        bggUsername: "refreshuser",
      }).lean();
      expect(doc.games[0].name).toBe("Forced");
    });

    it("shared across users: A populates Mongo, B reuses it after server restart", async () => {
      // User A — cold, populates Mongo
      fetchSpy.mockResolvedValueOnce(
        ok(collectionXml([{ id: "501", name: "Shared", thumbnail: "s.jpg" }])),
      );
      await request(app).get("/api/bgg/coleccion/userA");
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Simulate restart by clearing L1
      bggRouter.__resetCache();
      fetchSpy.mockClear();

      // User B looking at userA's collection again — Mongo serves
      const res = await request(app).get("/api/bgg/coleccion/userA");
      expect(res.status).toBe(200);
      expect(res.body[0].name).toBe("Shared");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("clearUserCache deletes the BggCollection Mongo doc", async () => {
      await BggCollection.create({
        bggUsername: "todelete",
        games: [{ id: "601", name: "X" }],
      });
      expect(
        await BggCollection.countDocuments({ bggUsername: "todelete" }),
      ).toBe(1);

      await bggRouter.clearUserCache("todelete");

      expect(
        await BggCollection.countDocuments({ bggUsername: "todelete" }),
      ).toBe(0);
    });
  });

  // ── ?refresh=1 bypasses the in-memory cache ──────────────────────
  describe("?refresh=1 query", () => {
    it("coleccion: serves cached on plain GET, hits BGG when refresh=1", async () => {
      const collectionXml = `<?xml version="1.0"?><items><item objectid="9001"><name>X</name></item></items>`;
      // First GET — cold, calls BGG
      fetchSpy.mockResolvedValueOnce(ok(collectionXml));
      await request(app).get("/api/bgg/coleccion/refreshtest");
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second GET without refresh — cache hit, BGG NOT called
      await request(app).get("/api/bgg/coleccion/refreshtest");
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Third GET with ?refresh=1 — bypasses cache, hits BGG again
      fetchSpy.mockResolvedValueOnce(ok(collectionXml));
      await request(app).get("/api/bgg/coleccion/refreshtest?refresh=1");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("partidas: serves cached on plain GET, hits BGG when refresh=1", async () => {
      // First GET — cold, calls /plays (no games in plays → no /thing call)
      fetchSpy.mockResolvedValueOnce(ok(playsXml([])));
      await request(app).get("/api/bgg/partidas/refreshtest");
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second GET without refresh — cache hit
      await request(app).get("/api/bgg/partidas/refreshtest");
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Third GET with ?refresh=1 — calls BGG again
      fetchSpy.mockResolvedValueOnce(ok(playsXml([])));
      await request(app).get("/api/bgg/partidas/refreshtest?refresh=1");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ── clearUserCache helper (used by auth/bgg-connect) ─────────────
  describe("clearUserCache", () => {
    it("drops the coleccion entry for that username", async () => {
      const xml = `<?xml version="1.0"?><items><item objectid="1"><name>A</name></item></items>`;

      // Cold → 1 BGG call
      fetchSpy.mockResolvedValueOnce(ok(xml));
      await request(app).get("/api/bgg/coleccion/clearuser");
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Warm → cache hit, no extra BGG call
      await request(app).get("/api/bgg/coleccion/clearuser");
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // After clearUserCache → cold again
      await bggRouter.clearUserCache("clearuser");
      fetchSpy.mockResolvedValueOnce(ok(xml));
      await request(app).get("/api/bgg/coleccion/clearuser");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("drops every partidas page/filter combo for that username", async () => {
      // Warm two distinct cache entries for the same username (different pages)
      fetchSpy.mockResolvedValueOnce(ok(playsXml([])));
      await request(app).get("/api/bgg/partidas/clearuser2?page=1");
      fetchSpy.mockResolvedValueOnce(ok(playsXml([])));
      await request(app).get("/api/bgg/partidas/clearuser2?page=4"); // separate BGG page
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Both pages are cached — no new BGG calls
      await request(app).get("/api/bgg/partidas/clearuser2?page=1");
      await request(app).get("/api/bgg/partidas/clearuser2?page=4");
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // clearUserCache wipes both entries
      await bggRouter.clearUserCache("clearuser2");
      fetchSpy.mockResolvedValueOnce(ok(playsXml([])));
      await request(app).get("/api/bgg/partidas/clearuser2?page=1");
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("is case-insensitive on the username (matches cache keys)", async () => {
      const xml = `<?xml version="1.0"?><items><item objectid="1"><name>A</name></item></items>`;
      fetchSpy.mockResolvedValueOnce(ok(xml));
      await request(app).get("/api/bgg/coleccion/MixedCase");
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Pass the mixed-case username — internal lowercasing should still match
      await bggRouter.clearUserCache("MixedCase");
      fetchSpy.mockResolvedValueOnce(ok(xml));
      await request(app).get("/api/bgg/coleccion/MixedCase");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ── GET /api/bgg/search ──────────────────────────────────────────
  describe("GET /api/bgg/search", () => {
    it("cold: enriches results with thumbnails from BGG and persists them", async () => {
      fetchSpy
        .mockResolvedValueOnce(
          ok(
            searchXml([
              { id: 6001, name: "Foo", year: 2020 },
              { id: 6002, name: "Bar", year: 2021 },
            ]),
          ),
        )
        .mockResolvedValueOnce(
          ok(
            thingXml([
              { id: 6001, name: "Foo", thumbnail: "foo.jpg" },
              { id: 6002, name: "Bar", thumbnail: "bar.jpg" },
            ]),
          ),
        );

      const res = await request(app).get("/api/bgg/search?q=foobar");
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 6001, thumbnail: "foo.jpg" }),
          expect.objectContaining({ id: 6002, thumbnail: "bar.jpg" }),
        ]),
      );
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(
        await BggGame.countDocuments({ gameId: { $in: [6001, 6002] } }),
      ).toBe(2);
    });

    it("warm: when both games are already in Mongo, BGG /thing is not called for thumbnails", async () => {
      await BggGame.create({ gameId: 7001, name: "X", thumbnail: "x.jpg" });
      await BggGame.create({ gameId: 7002, name: "Y", thumbnail: "y.jpg" });

      fetchSpy.mockResolvedValueOnce(
        ok(
          searchXml([
            { id: 7001, name: "X", year: 2018 },
            { id: 7002, name: "Y", year: 2019 },
          ]),
        ),
      );

      const res = await request(app).get("/api/bgg/search?q=warmsearch");
      expect(res.status).toBe(200);
      expect(res.body.find((g) => g.id === 7001).thumbnail).toBe("x.jpg");
      expect(res.body.find((g) => g.id === 7002).thumbnail).toBe("y.jpg");
      // Only the search call itself — no second call for /thing.
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toContain("/search");
    });
  });
});
