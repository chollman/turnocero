const request = require("supertest");
const app = require("../../app");
const BggPlay = require("../../models/BggPlay");
const BggPlayerOverlay = require("../../models/BggPlayerOverlay");
const { createAuthedUser, authHeader } = require("../helpers/auth");
const { encrypt } = require("../../utils/encryption");

// Avatar uploads go through Cloudinary; mock the boundary.
vi.mock("../../config/cloudinary", () => require("../mocks/cloudinary"));
// The bgg-username write-back sleeps between geekplay calls — make it instant.
vi.mock("../../utils/bggSync", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, sleep: vi.fn().mockResolvedValue(undefined) };
});

const { uploadToCloudinary, cloudinary } = require("../mocks/cloudinary");

// ── Fetch mocking (mirrors bgg-partidas-write.test.js) ─────────────────────
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
function geekplayResponse(payload = { playid: 1 }) {
  return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
}
function playsXmlResponse(plays) {
  const content = plays
    .map(
      (p) => `
    <play id="${p.id}" date="${p.date}" quantity="1" length="60" incomplete="0" nowinstats="0" location="">
      <item name="${p.gameName ?? "Game"}" objecttype="thing" objectid="${p.gameId}"/>
      <players><player username="${p.username ?? ""}" name="${p.name ?? "Juan"}" startposition="1" color="" score="" rating="0" new="0" win="0"/></players>
    </play>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><plays username="alice" userid="1" total="${plays.length}" page="1">${content}</plays>`;
  return { ok: true, status: 200, text: async () => xml };
}
function emptyPlaysResponse() {
  return playsXmlResponse([]);
}
function thingXmlResponse() {
  return {
    ok: true,
    status: 200,
    text: async () => `<?xml version="1.0" encoding="UTF-8"?><items></items>`,
  };
}
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
    if (route === undefined) throw new Error(`No mock for "${key}" (${u})`);
    if (Array.isArray(route)) {
      if (route.length === 0) throw new Error(`Queue exhausted "${key}"`);
      return route.shift();
    }
    return route;
  });
}

async function createOwner() {
  const { user, token } = await createAuthedUser({ bggUsername: "alice" });
  user.bggCredentials = {
    encryptedPassword: encrypt("pw"),
    connectedAt: new Date(),
    lastValidatedAt: new Date(),
    invalid: false,
  };
  await user.save();
  return { user, token };
}

// Seed a play for alice with the given players.
function seedPlay(playId, players, extra = {}) {
  return BggPlay.create({
    bggUsername: "alice",
    playId: String(playId),
    gameId: "174430",
    gameName: "Gloomhaven",
    date: extra.date || "2026-01-01",
    players,
    hash: `h${playId}`,
    ...extra,
  });
}

describe("BGG jugadores — curación del roster", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
    uploadToCloudinary.mockClear();
    cloudinary.uploader.destroy.mockClear();
  });

  // ── GET list ─────────────────────────────────────────────────────────
  describe("GET /api/bgg/jugadores/:bggUsername", () => {
    it("lists distinct co-players for the owner", async () => {
      const { token } = await createOwner();
      await seedPlay(1, [
        { name: "Alice", username: "alice" },
        { name: "Juan", username: "" },
      ]);
      await seedPlay(2, [{ name: "Juan", username: "" }], {
        date: "2026-02-01",
      });

      const res = await request(app)
        .get("/api/bgg/jugadores/alice")
        .set(authHeader(token));

      expect(res.status).toBe(200);
      const juan = res.body.items.find((i) => i.name === "Juan");
      expect(juan).toBeTruthy();
      expect(juan.numPlays).toBe(2);
      expect(juan.rawKeys).toEqual(["n:juan"]);
      expect(juan.isLinked).toBe(false);
    });

    it("applies a name override", async () => {
      const { token } = await createOwner();
      await seedPlay(1, [{ name: "Juan", username: "" }]);
      await BggPlayerOverlay.create({
        ownerUsername: "alice",
        rawKeys: ["n:juan"],
        nameOverride: "Juancito",
      });

      const res = await request(app)
        .get("/api/bgg/jugadores/alice")
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.items.some((i) => i.name === "Juancito")).toBe(true);
    });

    it("marks players linked to a TurnoCero member as not editable", async () => {
      const { token } = await createOwner();
      await createAuthedUser({ bggUsername: "bob", displayName: "Bob" });
      await seedPlay(1, [{ name: "Bob", username: "bob" }]);

      const res = await request(app)
        .get("/api/bgg/jugadores/alice")
        .set(authHeader(token));

      expect(res.status).toBe(200);
      const bob = res.body.items.find((i) => i.username === "bob");
      expect(bob.isLinked).toBe(true);
      expect(bob.canEditNameAvatar).toBe(false);
      expect(bob.linkedUser).toBeTruthy();
    });

    it("403 for a non-owner non-admin", async () => {
      await createOwner();
      const { token: other } = await createAuthedUser({ bggUsername: "zoe" });
      const res = await request(app)
        .get("/api/bgg/jugadores/alice")
        .set(authHeader(other));
      expect(res.status).toBe(403);
    });
  });

  // ── PATCH nombre ─────────────────────────────────────────────────────
  describe("PATCH /api/bgg/jugadores/:bggUsername/nombre", () => {
    it("upserts a name override", async () => {
      const { token } = await createOwner();
      await seedPlay(1, [{ name: "Juan", username: "" }]);

      const res = await request(app)
        .patch("/api/bgg/jugadores/alice/nombre")
        .set(authHeader(token))
        .send({ rawKeys: ["n:juan"], name: "Juancito" });

      expect(res.status).toBe(200);
      expect(res.body.player.name).toBe("Juancito");
      const overlay = await BggPlayerOverlay.findOne({ ownerUsername: "alice" });
      expect(overlay.nameOverride).toBe("Juancito");
    });

    it("409 when the player is linked to a TurnoCero member", async () => {
      const { token } = await createOwner();
      await createAuthedUser({ bggUsername: "bob" });
      await seedPlay(1, [{ name: "Bob", username: "bob" }]);

      const res = await request(app)
        .patch("/api/bgg/jugadores/alice/nombre")
        .set(authHeader(token))
        .send({ rawKeys: ["u:bob"], name: "Bobby" });

      expect(res.status).toBe(409);
    });
  });

  // ── PATCH bgg-username (write-back) ──────────────────────────────────
  describe("PATCH /api/bgg/jugadores/:bggUsername/bgg-username", () => {
    it("rewrites every affected play on BGG and re-keys the overlay", async () => {
      const { token } = await createOwner();
      await seedPlay(100, [{ name: "Juan", username: "" }]);
      await seedPlay(200, [{ name: "Juan", username: "" }]);

      const fetchSpy = makeFetchMock({
        login: loginResponse(),
        geekplay: geekplayResponse(),
        plays: [
          playsXmlResponse([{ id: 100, date: "2026-01-01", gameId: 174430 }]),
          playsXmlResponse([{ id: 200, date: "2026-01-01", gameId: 174430 }]),
        ],
        thing: thingXmlResponse(),
      });
      global.fetch = fetchSpy;

      const res = await request(app)
        .patch("/api/bgg/jugadores/alice/bgg-username")
        .set(authHeader(token))
        .send({ rawKeys: ["n:juan"], bggUsername: "juanbgg" });

      expect(res.status).toBe(200);
      expect(res.body.rewritten).toBe(2);
      expect(res.body.failed).toEqual([]);

      // geekplay called once per play, with the new username in the body.
      const geekplayCalls = fetchSpy.mock.calls.filter((c) =>
        String(c[0]).includes("/geekplay.php"),
      );
      expect(geekplayCalls).toHaveLength(2);
      expect(String(geekplayCalls[0][1].body)).toContain(
        "username%5D=juanbgg",
      );

      const overlay = await BggPlayerOverlay.findOne({ ownerUsername: "alice" });
      expect(overlay.bggUsername).toBe("juanbgg");
      expect(overlay.rawKeys).toContain("u:juanbgg");
      expect(overlay.rawKeys).not.toContain("n:juan");
    });

    it("reports partial failure when one play fails to verify", async () => {
      const { token } = await createOwner();
      await seedPlay(100, [{ name: "Juan", username: "" }]);
      await seedPlay(200, [{ name: "Juan", username: "" }]);

      global.fetch = makeFetchMock({
        login: loginResponse(),
        geekplay: geekplayResponse(),
        // play 100 verifies; play 200 stays empty on both attempts.
        plays: [
          playsXmlResponse([{ id: 100, date: "2026-01-01", gameId: 174430 }]),
          emptyPlaysResponse(),
          emptyPlaysResponse(),
        ],
        thing: thingXmlResponse(),
      });

      const res = await request(app)
        .patch("/api/bgg/jugadores/alice/bgg-username")
        .set(authHeader(token))
        .send({ rawKeys: ["n:juan"], bggUsername: "juanbgg" });

      expect(res.status).toBe(200);
      expect(res.body.rewritten).toBe(1);
      expect(res.body.failed).toEqual(["200"]);
    });

    it("403 for a non-owner (write-back needs the owner's BGG session)", async () => {
      await createOwner();
      const admin = await createAuthedUser({
        bggUsername: "adm",
        isAdmin: true,
      });
      const res = await request(app)
        .patch("/api/bgg/jugadores/alice/bgg-username")
        .set(authHeader(admin.token))
        .send({ rawKeys: ["n:juan"], bggUsername: "juanbgg" });
      expect(res.status).toBe(403);
    });
  });

  // ── Avatar ───────────────────────────────────────────────────────────
  describe("avatar", () => {
    it("PUT uploads to Cloudinary under turnocero/bgg-players/<id>", async () => {
      const { user, token } = await createOwner();
      await seedPlay(1, [{ name: "Juan", username: "" }]);

      const res = await request(app)
        .put("/api/bgg/jugadores/alice/avatar")
        .set(authHeader(token))
        .field("rawKeys", JSON.stringify(["n:juan"]))
        .attach("avatar", Buffer.from([1, 2, 3, 4]), "a.png");

      expect(res.status).toBe(200);
      expect(uploadToCloudinary).toHaveBeenCalledTimes(1);
      const opts = uploadToCloudinary.mock.calls[0][1];
      expect(opts.folder).toBe(`turnocero/bgg-players/${user._id}`);
      expect(res.body.player.avatar.url).toBeTruthy();
    });

    it("PUT 409 when linked to a TurnoCero member", async () => {
      const { token } = await createOwner();
      await createAuthedUser({ bggUsername: "bob" });
      await seedPlay(1, [{ name: "Bob", username: "bob" }]);

      const res = await request(app)
        .put("/api/bgg/jugadores/alice/avatar")
        .set(authHeader(token))
        .field("rawKeys", JSON.stringify(["u:bob"]))
        .attach("avatar", Buffer.from([1, 2, 3, 4]), "a.png");

      expect(res.status).toBe(409);
    });

    it("DELETE clears the avatar and destroys the asset", async () => {
      const { token } = await createOwner();
      await BggPlayerOverlay.create({
        ownerUsername: "alice",
        rawKeys: ["n:juan"],
        avatar: { url: "http://x/a.webp", publicId: "pid1" },
      });

      const res = await request(app)
        .delete("/api/bgg/jugadores/alice/avatar")
        .set(authHeader(token))
        .send({ rawKeys: ["n:juan"] });

      expect(res.status).toBe(200);
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("pid1");
      const overlay = await BggPlayerOverlay.findOne({ ownerUsername: "alice" });
      expect(overlay.avatar.url).toBe("");
    });
  });

  // ── Merge ────────────────────────────────────────────────────────────
  describe("POST /api/bgg/jugadores/:bggUsername/merge", () => {
    it("folds source raw keys into the target overlay", async () => {
      const { token } = await createOwner();
      await seedPlay(1, [
        { name: "Juan", username: "" },
        { name: "Juancho", username: "" },
      ]);

      const res = await request(app)
        .post("/api/bgg/jugadores/alice/merge")
        .set(authHeader(token))
        .send({ targetRawKeys: ["n:juan"], sourceRawKeys: ["n:juancho"] });

      expect(res.status).toBe(200);
      const overlays = await BggPlayerOverlay.find({ ownerUsername: "alice" });
      expect(overlays).toHaveLength(1);
      expect(overlays[0].rawKeys.sort()).toEqual(["n:juan", "n:juancho"]);
    });

    it("400 when merging a player into itself", async () => {
      const { token } = await createOwner();
      const res = await request(app)
        .post("/api/bgg/jugadores/alice/merge")
        .set(authHeader(token))
        .send({ targetRawKeys: ["n:juan"], sourceRawKeys: ["n:juan"] });
      expect(res.status).toBe(400);
    });
  });

  // ── Overlay reflected on read paths ──────────────────────────────────
  describe("overlay reflected on read paths", () => {
    it("mis-jugadores reflects a name override + merge", async () => {
      await createOwner();
      await seedPlay(1, [
        { name: "Juan", username: "" },
        { name: "Juancho", username: "" },
      ]);
      await BggPlayerOverlay.create({
        ownerUsername: "alice",
        rawKeys: ["n:juan", "n:juancho"],
        nameOverride: "Juancito",
      });

      const res = await request(app).get("/api/bgg/mis-jugadores/alice");
      expect(res.status).toBe(200);
      // The two raw players collapse into one curated "Juancito".
      expect(res.body.items.filter((i) => i.name === "Juancito")).toHaveLength(
        1,
      );
      expect(res.body.items.some((i) => i.name === "Juancho")).toBe(false);
    });

    it("partidas reflects the name override in players", async () => {
      await createOwner();
      await seedPlay(1, [{ name: "Juan", username: "" }]);
      await BggPlayerOverlay.create({
        ownerUsername: "alice",
        rawKeys: ["n:juan"],
        nameOverride: "Juancito",
      });
      // Defensive: a probe should not run for an anonymous viewer, but mock
      // fetch just in case so a stray call can't hit the network.
      global.fetch = makeFetchMock({
        plays: emptyPlaysResponse(),
        thing: thingXmlResponse(),
        login: loginResponse(),
        geekplay: geekplayResponse(),
      });

      const res = await request(app).get("/api/bgg/partidas/alice");
      expect(res.status).toBe(200);
      const play = res.body.plays.find((p) => p.id === "1");
      expect(play.players[0].name).toBe("Juancito");
    });
  });
});
