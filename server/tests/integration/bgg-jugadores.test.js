const request = require("supertest");
const app = require("../../app");
const BggPlay = require("../../models/BggPlay");
const BggPlayerOverlay = require("../../models/BggPlayerOverlay");
const User = require("../../models/User");
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

    it("permite override de nombre para un vinculado (gana sobre TurnoCero)", async () => {
      const { token } = await createOwner();
      await createAuthedUser({ bggUsername: "bob" });
      await seedPlay(1, [{ name: "Bob", username: "bob" }]);

      const res = await request(app)
        .patch("/api/bgg/jugadores/alice/nombre")
        .set(authHeader(token))
        .send({ rawKeys: ["u:bob"], name: "Bobby" });

      expect(res.status).toBe(200);
      expect(res.body.player.name).toBe("Bobby");
      const overlay = await BggPlayerOverlay.findOne({
        ownerUsername: "alice",
        rawKeys: "u:bob",
      });
      expect(overlay.nameOverride).toBe("Bobby");
    });

    it("el override de un vinculado se refleja como overlayName al leer partidas", async () => {
      const { token } = await createOwner();
      await createAuthedUser({ bggUsername: "bob" });
      await seedPlay(1, [{ name: "Bob", username: "bob" }]);
      await request(app)
        .patch("/api/bgg/jugadores/alice/nombre")
        .set(authHeader(token))
        .send({ rawKeys: ["u:bob"], name: "Bobby" });

      const list = await request(app).get("/api/bgg/partidas/alice");
      const play = list.body.plays.find((p) => p.id === "1");
      const bob = play.players.find((p) => p.username === "bob");
      expect(bob.overlayName).toBe("Bobby");
      expect(bob.name).toBe("Bobby");
    });
  });

  // ── PATCH bgg-username (overlay local, sin write-back) ───────────────
  describe("PATCH /api/bgg/jugadores/:bggUsername/bgg-username", () => {
    it("vincula el @BGG localmente sin tocar BGG y re-keya el overlay", async () => {
      const { token } = await createOwner();
      await seedPlay(100, [{ name: "Juan", username: "" }]);
      await seedPlay(200, [{ name: "Juan", username: "" }]);
      // Si tocara BGG, este fetch tiraría — debe quedar sin usar.
      global.fetch = vi.fn(() => {
        throw new Error("no debería contactar BGG");
      });

      const res = await request(app)
        .patch("/api/bgg/jugadores/alice/bgg-username")
        .set(authHeader(token))
        .send({ rawKeys: ["n:juan"], bggUsername: "juanbgg" });

      expect(res.status).toBe(200);
      expect(res.body.player.username).toBe("juanbgg");
      expect(global.fetch).not.toHaveBeenCalled();

      // Las partidas en Mongo (espejo de BGG) NO se modifican.
      const plays = await BggPlay.find({ bggUsername: "alice" }).lean();
      for (const p of plays) {
        expect((p.players[0].username || "")).toBe("");
      }

      const overlay = await BggPlayerOverlay.findOne({ ownerUsername: "alice" });
      expect(overlay.bggUsername).toBe("juanbgg");
      expect(overlay.rawKeys).toContain("u:juanbgg");
      // Conserva la key por-nombre para que el vínculo aplique al histórico.
      expect(overlay.rawKeys).toContain("n:juan");
    });

    it("se refleja al leer las partidas (sin reescribir el espejo)", async () => {
      const { token } = await createOwner();
      await seedPlay(1, [{ name: "Juan", username: "" }]);
      await request(app)
        .patch("/api/bgg/jugadores/alice/bgg-username")
        .set(authHeader(token))
        .send({ rawKeys: ["n:juan"], bggUsername: "juanbgg" });

      const list = await request(app).get("/api/bgg/partidas/alice");
      const play = list.body.plays.find((p) => p.id === "1");
      expect(play.players[0].username).toBe("juanbgg");
    });

    it("lo puede hacer un admin (no requiere sesión de BGG)", async () => {
      await createOwner();
      await seedPlay(1, [{ name: "Juan", username: "" }]);
      const admin = await createAuthedUser({
        bggUsername: "adm",
        isAdmin: true,
      });
      const res = await request(app)
        .patch("/api/bgg/jugadores/alice/bgg-username")
        .set(authHeader(admin.token))
        .send({ rawKeys: ["n:juan"], bggUsername: "juanbgg" });
      expect(res.status).toBe(200);
    });

    it("403 para un no-dueño no-admin", async () => {
      await createOwner();
      const { token: other } = await createAuthedUser({ bggUsername: "zoe" });
      const res = await request(app)
        .patch("/api/bgg/jugadores/alice/bgg-username")
        .set(authHeader(other))
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

    it("PUT permite avatar para un vinculado (gana sobre TurnoCero)", async () => {
      const { token } = await createOwner();
      await createAuthedUser({ bggUsername: "bob" });
      await seedPlay(1, [{ name: "Bob", username: "bob" }]);

      const res = await request(app)
        .put("/api/bgg/jugadores/alice/avatar")
        .set(authHeader(token))
        .field("rawKeys", JSON.stringify(["u:bob"]))
        .attach("avatar", Buffer.from([1, 2, 3, 4]), "a.png");

      expect(res.status).toBe(200);
      expect(res.body.player.avatar.url).toBeTruthy();
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

  // ── "Sos vos" (isSelf) ───────────────────────────────────────────────
  describe("POST /api/bgg/jugadores/:bggUsername/yo-mismo", () => {
    it("marca un jugador como el dueño: lo lista con flag y lo excluye del picker", async () => {
      const { token } = await createOwner();
      await seedPlay(1, [
        { name: "Ale", username: "" },
        { name: "Ana", username: "" },
      ]);

      const res = await request(app)
        .post("/api/bgg/jugadores/alice/yo-mismo")
        .set(authHeader(token))
        .send({ rawKeys: ["n:ale"], value: true });
      expect(res.status).toBe(200);
      expect(res.body.player.isSelf).toBe(true);

      // La pestaña Jugadores lo muestra con el flag (para poder deshacer).
      const list = await request(app)
        .get("/api/bgg/jugadores/alice")
        .set(authHeader(token));
      const ale = list.body.items.find((i) => i.name === "Ale");
      expect(ale.isSelf).toBe(true);

      // El selector de carga (mis-jugadores) lo excluye.
      const picker = await request(app).get("/api/bgg/mis-jugadores/alice");
      expect(picker.body.items.some((i) => i.name === "Ale")).toBe(false);
      expect(picker.body.items.some((i) => i.name === "Ana")).toBe(true);
    });

    it("desmarca con value:false", async () => {
      const { token } = await createOwner();
      await seedPlay(1, [{ name: "Ale", username: "" }]);
      await BggPlayerOverlay.create({
        ownerUsername: "alice",
        rawKeys: ["n:ale"],
        isSelf: true,
      });

      const res = await request(app)
        .post("/api/bgg/jugadores/alice/yo-mismo")
        .set(authHeader(token))
        .send({ rawKeys: ["n:ale"], value: false });
      expect(res.status).toBe(200);
      expect(res.body.player.isSelf).toBe(false);

      const picker = await request(app).get("/api/bgg/mis-jugadores/alice");
      expect(picker.body.items.some((i) => i.name === "Ale")).toBe(true);
    });

    it("403 para un no-dueño no-admin", async () => {
      await createOwner();
      const { token: other } = await createAuthedUser({ bggUsername: "zoe" });
      const res = await request(app)
        .post("/api/bgg/jugadores/alice/yo-mismo")
        .set(authHeader(other))
        .send({ rawKeys: ["n:ale"], value: true });
      expect(res.status).toBe(403);
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

  // ── gameStats refleja "sos vos" (isSelf) end-to-end ──────────────────
  describe("gameStats refleja 'sos vos' en GET /partidas?id=", () => {
    it("las victorias bajo un alias marcado isSelf cuentan en el win-rate del dueño", async () => {
      const { token } = await createOwner();
      // El dueño se cargó como "Juancho" (sin username) y ganó esa partida.
      await seedPlay(1, [{ name: "Juancho", username: "", win: true }]);
      // Defensivo: ningún probe corre para viewer anónimo, pero mockeamos fetch.
      global.fetch = makeFetchMock({
        plays: emptyPlaysResponse(),
        thing: thingXmlResponse(),
        login: loginResponse(),
        geekplay: geekplayResponse(),
      });

      // Antes de marcar: el dueño no figura por username → no cuenta.
      const before = await request(app).get(
        "/api/bgg/partidas/alice?id=174430",
      );
      expect(before.status).toBe(200);
      expect(before.body.gameStats).toMatchObject({ wins: 0, rated: 0 });

      // Marca "sos vos" sobre el alias por-nombre.
      const mark = await request(app)
        .post("/api/bgg/jugadores/alice/yo-mismo")
        .set(authHeader(token))
        .send({ rawKeys: ["n:juancho"], value: true });
      expect(mark.status).toBe(200);

      // Ahora la victoria del alias cuenta como del dueño.
      const after = await request(app).get("/api/bgg/partidas/alice?id=174430");
      expect(after.status).toBe(200);
      expect(after.body.gameStats).toMatchObject({ wins: 1, rated: 1 });
    });
  });

  // ── Invalidación: la curación marca "Mis juegos" sucio ───────────────
  describe("invalidación del cache derivado tras curar jugadores", () => {
    async function buildSelectorCache(userId) {
      // Simula un selector "Mis juegos" ya construido (builtAt no-null).
      await User.updateOne(
        { _id: userId },
        { $set: { "bggSync.userGamesBuiltAt": new Date() } },
      );
    }

    it("yo-mismo marca userGamesBuiltAt = null", async () => {
      const { user, token } = await createOwner();
      await buildSelectorCache(user._id);
      await seedPlay(1, [{ name: "Ale", username: "" }]);

      await request(app)
        .post("/api/bgg/jugadores/alice/yo-mismo")
        .set(authHeader(token))
        .send({ rawKeys: ["n:ale"], value: true });

      const fresh = await User.findById(user._id).lean();
      expect(fresh.bggSync.userGamesBuiltAt).toBeNull();
    });

    it("merge marca userGamesBuiltAt = null", async () => {
      const { user, token } = await createOwner();
      await buildSelectorCache(user._id);
      await seedPlay(1, [
        { name: "Juan", username: "" },
        { name: "Juancho", username: "" },
      ]);

      await request(app)
        .post("/api/bgg/jugadores/alice/merge")
        .set(authHeader(token))
        .send({ targetRawKeys: ["n:juan"], sourceRawKeys: ["n:juancho"] });

      const fresh = await User.findById(user._id).lean();
      expect(fresh.bggSync.userGamesBuiltAt).toBeNull();
    });

    it("el override de nombre marca userGamesBuiltAt = null", async () => {
      const { user, token } = await createOwner();
      await buildSelectorCache(user._id);
      await seedPlay(1, [{ name: "Juan", username: "" }]);

      await request(app)
        .patch("/api/bgg/jugadores/alice/nombre")
        .set(authHeader(token))
        .send({ rawKeys: ["n:juan"], name: "Juancito" });

      const fresh = await User.findById(user._id).lean();
      expect(fresh.bggSync.userGamesBuiltAt).toBeNull();
    });
  });
});
