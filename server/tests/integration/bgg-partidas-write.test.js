const request = require("supertest");
const app = require("../../app");
const BggPlay = require("../../models/BggPlay");
const { createAuthedUser, authHeader } = require("../helpers/auth");
const bggRouter = require("../../routes/bgg");
const { encrypt } = require("../../utils/encryption");

// ── Fetch mocking ────────────────────────────────────────────────────
//
// The three write endpoints (POST/PUT/DELETE /api/bgg/partidas) hit BGG
// at three URLs:
//   - https://boardgamegeek.com/login/api/v1   (cookie acquisition)
//   - https://boardgamegeek.com/geekplay.php    (the mutation)
//   - https://boardgamegeek.com/xmlapi2/plays?  (verification fetch)
//
// We mock global.fetch with a URL-routed handler so each test can declare
// per-URL behavior. A queue lets us inject sequential responses for the
// same URL (used by the "first verify fails, retry succeeds" test).

function loginResponse() {
  return {
    ok: true,
    status: 200,
    headers: {
      getSetCookie: () => ["bggusername=test; Path=/", "SessionID=abc; Path=/"],
    },
    text: async () => "",
  };
}

function geekplayResponse(payload = { playid: 999 }) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
  };
}

function geekplayHtmlResponse() {
  return {
    ok: true,
    status: 200,
    text: async () => "<html>session expired</html>",
  };
}

function playsXmlResponse(plays, total) {
  const playsContent = plays
    .map(
      (p) => `
    <play id="${p.id}" date="${p.date}" quantity="${p.quantity ?? 1}" length="${p.length ?? 60}" incomplete="0" nowinstats="0" location="${p.location ?? ""}">
      <item name="${p.gameName ?? "Game"}" objecttype="thing" objectid="${p.gameId}"/>
      <players><player username="" name="Solo" startposition="1" color="" score="${p.score ?? ""}" rating="0" new="0" win="1"/></players>
    </play>
  `,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><plays username="user" userid="1" total="${total ?? plays.length}" page="1">${playsContent}</plays>`;
  return { ok: true, status: 200, text: async () => xml };
}

function emptyPlaysResponse() {
  return playsXmlResponse([], 0);
}

function thingXmlResponse() {
  // /thing lookups for resolveGame; minimal valid XML so it doesn't crash.
  return {
    ok: true,
    status: 200,
    text: async () => `<?xml version="1.0" encoding="UTF-8"?><items></items>`,
  };
}

/**
 * Builds a fetch mock that routes by URL. Each route value is either a
 * Response-like object (used for every matching call) or an array (used as
 * a FIFO queue; once exhausted, the test fails).
 */
function makeFetchMock(routes) {
  const queues = {};
  for (const [key, val] of Object.entries(routes)) {
    queues[key] = Array.isArray(val) ? [...val] : val;
  }
  return vi.fn(async (url) => {
    const u = String(url);
    let key;
    if (u.includes("/login/api/v1")) key = "login";
    else if (u.includes("/geekplay.php")) key = "geekplay";
    else if (u.includes("/xmlapi2/plays")) key = "plays";
    else if (u.includes("/xmlapi2/thing")) key = "thing";
    else throw new Error(`Unmocked fetch URL: ${u}`);

    const route = queues[key];
    if (route === undefined) {
      throw new Error(`No mock configured for route "${key}" (${u})`);
    }
    if (Array.isArray(route)) {
      if (route.length === 0) {
        throw new Error(`Mock queue exhausted for route "${key}" (${u})`);
      }
      return route.shift();
    }
    return route;
  });
}

async function createBggUser() {
  const { user, token } = await createAuthedUser({
    bggUsername: "alice",
  });
  // Attach encrypted BGG credentials so getSessionCookie proceeds to login.
  user.bggCredentials = {
    encryptedPassword: encrypt("plaintext-password"),
    connectedAt: new Date(),
    lastValidatedAt: new Date(),
    invalid: false,
  };
  await user.save();
  return { user, token };
}

const validBody = {
  objectid: 174430, // Gloomhaven
  playdate: "2026-05-20",
  length: 120,
  location: "Sala",
  quantity: 1,
  comments: "Excelente partida",
  incomplete: false,
  nowinstats: false,
  players: [
    {
      name: "Alice",
      username: "alice",
      position: 1,
      score: "42",
      win: true,
      new: false,
    },
  ],
};

describe("BGG write endpoints — BGG-first verification", () => {
  let fetchSpy;

  beforeEach(() => {
    bggRouter.__resetCache();
    fetchSpy = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
  });

  // ── POST /api/bgg/partidas ────────────────────────────────────────
  describe("POST /api/bgg/partidas", () => {
    it("returns 200 and mirrors to Mongo when BGG confirms the new play", async () => {
      const { user, token } = await createBggUser();
      // Pre-seed BggPlay so the route enters Mongo-mirrored mode.
      await BggPlay.create({
        bggUsername: "alice",
        playId: "100",
        gameId: "1",
        date: "2026-01-01",
        players: [],
        hash: "x",
      });

      fetchSpy = makeFetchMock({
        login: loginResponse(),
        geekplay: geekplayResponse({ playid: 999 }),
        plays: playsXmlResponse([
          {
            id: 999,
            date: "2026-05-20",
            gameId: 174430,
            gameName: "Gloomhaven",
          },
        ]),
        thing: thingXmlResponse(),
      });
      global.fetch = fetchSpy;

      const res = await request(app)
        .post("/api/bgg/partidas")
        .set(authHeader(token))
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.playid).toBe("999");
      expect(res.body.play).toMatchObject({
        id: "999",
        gameId: "174430",
        date: "2026-05-20",
      });

      const stored = await BggPlay.findOne({
        bggUsername: "alice",
        playId: "999",
      }).lean();
      expect(stored).toBeTruthy();
      expect(stored.gameId).toBe("174430");
      expect(stored.date).toBe("2026-05-20");
      // Suppress unused-var warning; user object exists for fixture completeness.
      expect(user.bggUsername).toBe("alice");

      // Verification must narrow by gameId + date (BGG's /plays?id= is the
      // GAME id, not the play id — a bare ?id=PLAYID would query the wrong
      // game and falsely return empty). Lock in the fix.
      const playsCall = fetchSpy.mock.calls.find((c) =>
        String(c[0]).includes("/xmlapi2/plays"),
      );
      expect(playsCall).toBeTruthy();
      const url = String(playsCall[0]);
      expect(url).toContain("id=174430");
      expect(url).toContain("mindate=2026-05-20");
      expect(url).toContain("maxdate=2026-05-20");
    });

    it("returns 502 and skips Mongo write when geekplay omits playid", async () => {
      const { token } = await createBggUser();

      fetchSpy = makeFetchMock({
        login: loginResponse(),
        geekplay: geekplayHtmlResponse(),
        // verification should never be reached; provide a defensive default.
        plays: emptyPlaysResponse(),
        thing: thingXmlResponse(),
      });
      global.fetch = fetchSpy;

      const res = await request(app)
        .post("/api/bgg/partidas")
        .set(authHeader(token))
        .send(validBody);

      expect(res.status).toBe(502);
      expect(res.body.message).toMatch(/no devolvió un ID/i);

      const stored = await BggPlay.find({ bggUsername: "alice" }).lean();
      expect(stored).toHaveLength(0);
    });

    it("returns 502 and skips Mongo write when BGG can't find the play after the write", async () => {
      const { token } = await createBggUser();

      fetchSpy = makeFetchMock({
        login: loginResponse(),
        geekplay: geekplayResponse({ playid: 999 }),
        // Both verification attempts (initial + retry) return empty.
        plays: [emptyPlaysResponse(), emptyPlaysResponse()],
        thing: thingXmlResponse(),
      });
      global.fetch = fetchSpy;

      const res = await request(app)
        .post("/api/bgg/partidas")
        .set(authHeader(token))
        .send(validBody);

      expect(res.status).toBe(502);
      expect(res.body.message).toMatch(/no confirmó la partida/i);

      const stored = await BggPlay.find({
        bggUsername: "alice",
        playId: "999",
      }).lean();
      expect(stored).toHaveLength(0);
    });

    it("succeeds when verification is empty on first attempt but BGG returns the play on retry", async () => {
      const { token } = await createBggUser();
      await BggPlay.create({
        bggUsername: "alice",
        playId: "100",
        gameId: "1",
        date: "2026-01-01",
        players: [],
        hash: "x",
      });

      fetchSpy = makeFetchMock({
        login: loginResponse(),
        geekplay: geekplayResponse({ playid: 999 }),
        plays: [
          emptyPlaysResponse(),
          playsXmlResponse([
            {
              id: 999,
              date: "2026-05-20",
              gameId: 174430,
              gameName: "Gloomhaven",
            },
          ]),
        ],
        thing: thingXmlResponse(),
      });
      global.fetch = fetchSpy;

      const res = await request(app)
        .post("/api/bgg/partidas")
        .set(authHeader(token))
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body.playid).toBe("999");

      const stored = await BggPlay.findOne({
        bggUsername: "alice",
        playId: "999",
      }).lean();
      expect(stored).toBeTruthy();
    });

    it("does not mirror to Mongo if the user is not yet in Mongo-served mode", async () => {
      // No BggPlay docs pre-seeded — user hasn't done initial sync.
      const { token } = await createBggUser();

      fetchSpy = makeFetchMock({
        login: loginResponse(),
        geekplay: geekplayResponse({ playid: 999 }),
        plays: playsXmlResponse([
          {
            id: 999,
            date: "2026-05-20",
            gameId: 174430,
            gameName: "Gloomhaven",
          },
        ]),
        thing: thingXmlResponse(),
      });
      global.fetch = fetchSpy;

      const res = await request(app)
        .post("/api/bgg/partidas")
        .set(authHeader(token))
        .send(validBody);

      expect(res.status).toBe(200);
      // Verification still ran, but no Mongo doc was created.
      const stored = await BggPlay.find({ bggUsername: "alice" }).lean();
      expect(stored).toHaveLength(0);
    });
  });

  // ── PUT /api/bgg/partidas/:playId ─────────────────────────────────
  describe("PUT /api/bgg/partidas/:playId", () => {
    it("returns 200 and replaces Mongo doc with canonical BGG data on success", async () => {
      const { token } = await createBggUser();
      await BggPlay.create({
        bggUsername: "alice",
        playId: "777",
        gameId: "174430",
        date: "2026-05-19",
        location: "old",
        players: [],
        hash: "old-hash",
      });

      fetchSpy = makeFetchMock({
        login: loginResponse(),
        geekplay: geekplayResponse({ playid: 777 }),
        plays: playsXmlResponse([
          {
            id: 777,
            date: "2026-05-20",
            gameId: 174430,
            gameName: "Gloomhaven",
            location: "Sala",
          },
        ]),
        thing: thingXmlResponse(),
      });
      global.fetch = fetchSpy;

      const res = await request(app)
        .put("/api/bgg/partidas/777")
        .set(authHeader(token))
        .send(validBody);

      expect(res.status).toBe(200);
      const stored = await BggPlay.findOne({
        bggUsername: "alice",
        playId: "777",
      }).lean();
      expect(stored.date).toBe("2026-05-20");
      expect(stored.location).toBe("Sala");
    });

    it("returns 502 and leaves Mongo untouched when verification finds no play", async () => {
      const { token } = await createBggUser();
      await BggPlay.create({
        bggUsername: "alice",
        playId: "777",
        gameId: "174430",
        date: "2026-05-19",
        location: "old",
        players: [],
        hash: "old-hash",
      });

      fetchSpy = makeFetchMock({
        login: loginResponse(),
        geekplay: geekplayResponse({}),
        plays: [emptyPlaysResponse(), emptyPlaysResponse()],
        thing: thingXmlResponse(),
      });
      global.fetch = fetchSpy;

      const res = await request(app)
        .put("/api/bgg/partidas/777")
        .set(authHeader(token))
        .send(validBody);

      expect(res.status).toBe(502);
      expect(res.body.message).toMatch(/no confirmó la edición/i);

      const stored = await BggPlay.findOne({
        bggUsername: "alice",
        playId: "777",
      }).lean();
      // Untouched: still the old "2026-05-19" / "old" values.
      expect(stored.date).toBe("2026-05-19");
      expect(stored.location).toBe("old");
    });
  });

  // ── DELETE /api/bgg/partidas/:playId ──────────────────────────────
  describe("DELETE /api/bgg/partidas/:playId", () => {
    it("returns 200 and removes Mongo doc when BGG confirms the play is gone", async () => {
      const { token } = await createBggUser();
      await BggPlay.create({
        bggUsername: "alice",
        playId: "555",
        gameId: "174430",
        date: "2026-05-19",
        players: [],
        hash: "h",
      });

      fetchSpy = makeFetchMock({
        login: loginResponse(),
        geekplay: geekplayResponse({}),
        // Both verification attempts return empty → confirmed gone.
        plays: [emptyPlaysResponse(), emptyPlaysResponse()],
      });
      global.fetch = fetchSpy;

      const res = await request(app)
        .delete("/api/bgg/partidas/555")
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const stored = await BggPlay.findOne({
        bggUsername: "alice",
        playId: "555",
      }).lean();
      expect(stored).toBeNull();

      // BGG's delete requires finalize=1&B1=Yes to bypass its confirmation
      // page — without these, BGG returns HTML asking "are you sure?" and
      // never actually deletes. Lock this in as a regression test.
      const geekplayCalls = fetchSpy.mock.calls.filter((c) =>
        String(c[0]).includes("/geekplay.php"),
      );
      expect(geekplayCalls).toHaveLength(1);
      const geekplayBody = String(geekplayCalls[0][1]?.body ?? "");
      expect(geekplayBody).toContain("finalize=1");
      expect(geekplayBody).toContain("B1=Yes");
    });

    it("returns 502 and keeps Mongo doc when BGG still has the play", async () => {
      const { token } = await createBggUser();
      await BggPlay.create({
        bggUsername: "alice",
        playId: "555",
        gameId: "174430",
        date: "2026-05-19",
        players: [],
        hash: "h",
      });

      fetchSpy = makeFetchMock({
        login: loginResponse(),
        geekplay: geekplayResponse({}),
        // BGG still has the play on both attempts → delete didn't take.
        plays: playsXmlResponse([
          {
            id: 555,
            date: "2026-05-19",
            gameId: 174430,
            gameName: "Gloomhaven",
          },
        ]),
        thing: thingXmlResponse(),
      });
      global.fetch = fetchSpy;

      const res = await request(app)
        .delete("/api/bgg/partidas/555")
        .set(authHeader(token));

      expect(res.status).toBe(502);
      expect(res.body.message).toMatch(/no confirmó el borrado/i);

      const stored = await BggPlay.findOne({
        bggUsername: "alice",
        playId: "555",
      }).lean();
      expect(stored).toBeTruthy();
    });
  });

  // ── Guards ────────────────────────────────────────────────────────
  describe("guards", () => {
    it("POST returns 400 if bggUsername is not configured", async () => {
      const { token } = await createAuthedUser({ bggUsername: "" });
      // No fetch mock — should never be called.
      global.fetch = vi.fn(() => {
        throw new Error("fetch should not be called");
      });

      const res = await request(app)
        .post("/api/bgg/partidas")
        .set(authHeader(token))
        .send(validBody);

      expect(res.status).toBe(400);
    });

    it("DELETE returns 400 for non-numeric playId", async () => {
      const { token } = await createBggUser();
      global.fetch = vi.fn(() => {
        throw new Error("fetch should not be called");
      });

      const res = await request(app)
        .delete("/api/bgg/partidas/not-a-number")
        .set(authHeader(token));

      expect(res.status).toBe(400);
    });
  });
});
