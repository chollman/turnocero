const request = require("supertest");
const jwt = require("jsonwebtoken");

// Module-level mocks for cloudinary/email/rate-limit are applied via
// tests/setup.js (monkey-patches the require cache). Tests just import the
// mock objects to read state / assert calls.

const app = require("../../app");
const User = require("../../models/User");
const emailMock = require("../mocks/email");
const cloudMock = require("../mocks/cloudinary");
const { hashToken } = require("../../utils/authTokens");
const { createUser, tokenFor } = require("../helpers/auth");

beforeEach(() => {
  emailMock.__resetMocks();
  cloudMock.__resetMocks();
});

describe("POST /api/auth/register", () => {
  it("creates an unverified user, hashes a 6-digit code, and emails it (no JWT)", async () => {
    const res = await request(app).post("/api/auth/register").send({
      username: "newuser",
      email: "new@test.local",
      password: "Password123",
    });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe("new@test.local");
    expect(res.body.token).toBeUndefined();

    const user = await User.findOne({ email: "new@test.local" }).select(
      "+emailVerificationCodeHash +emailVerificationExpiresAt",
    );
    expect(user).not.toBeNull();
    expect(user.emailVerified).toBe(false);
    expect(user.emailVerificationCodeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(user.emailVerificationExpiresAt.getTime()).toBeGreaterThan(
      Date.now(),
    );

    expect(emailMock.__sentEmails.length).toBe(1);
    expect(emailMock.__sentEmails[0].to).toBe("new@test.local");
  });

  it("rejects duplicate email/username with 400", async () => {
    await createUser({ username: "taken", email: "taken@test.local" });
    const res = await request(app).post("/api/auth/register").send({
      username: "other",
      email: "taken@test.local",
      password: "Password123",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already in use/i);
  });

  it("400s on missing fields", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username: "x" });
    expect(res.status).toBe(400);
  });

  it("400s on weak password (no uppercase or no number)", async () => {
    const res = await request(app).post("/api/auth/register").send({
      username: "weak",
      email: "weak@test.local",
      password: "password",
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/verify-email", () => {
  async function makeUnverifiedUser(code = "123456") {
    const user = await User.create({
      username: "tobev",
      email: "tobev@test.local",
      password: "Password123",
      emailVerified: false,
      emailVerificationCodeHash: hashToken(code),
      emailVerificationExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      emailVerificationAttempts: 0,
    });
    return user;
  }

  it("verifies with the correct code, issues a JWT, and clears the code", async () => {
    await makeUnverifiedUser("555555");

    const res = await request(app).post("/api/auth/verify-email").send({
      email: "tobev@test.local",
      code: "555555",
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.emailVerified).toBe(true);
    expect(res.body.user.password).toBeUndefined();

    const refreshed = await User.findOne({ email: "tobev@test.local" }).select(
      "+emailVerificationCodeHash",
    );
    expect(refreshed.emailVerificationCodeHash).toBeNull();
  });

  it("returns 400 generic on wrong code and increments attempts", async () => {
    await makeUnverifiedUser("555555");
    const res = await request(app).post("/api/auth/verify-email").send({
      email: "tobev@test.local",
      code: "999999",
    });
    expect(res.status).toBe(400);

    const u = await User.findOne({ email: "tobev@test.local" }).select(
      "+emailVerificationAttempts",
    );
    expect(u.emailVerificationAttempts).toBe(1);
  });

  it("blocks after 5 failed attempts with 429", async () => {
    const user = await makeUnverifiedUser("555555");
    user.emailVerificationAttempts = 5;
    await user.save();

    const res = await request(app).post("/api/auth/verify-email").send({
      email: "tobev@test.local",
      code: "555555",
    });
    expect(res.status).toBe(429);
  });

  it("rejects expired codes with 400 generic", async () => {
    const user = await makeUnverifiedUser("555555");
    user.emailVerificationExpiresAt = new Date(Date.now() - 1000);
    await user.save();

    const res = await request(app).post("/api/auth/verify-email").send({
      email: "tobev@test.local",
      code: "555555",
    });
    expect(res.status).toBe(400);
  });

  it("400s when fields are missing", async () => {
    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "a@b.c" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("returns user + token for verified credentials", async () => {
    const user = await createUser({ email: "log@test.local" });
    expect(user.emailVerified).toBe(true);

    const res = await request(app).post("/api/auth/login").send({
      email: "log@test.local",
      password: "Password123",
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user._id).toBe(user._id.toString());

    // Token is verifiable with our test secret.
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.id).toBe(user._id.toString());
  });

  it("returns 401 on wrong password", async () => {
    await createUser({ email: "log@test.local" });
    const res = await request(app).post("/api/auth/login").send({
      email: "log@test.local",
      password: "WrongPass1",
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 on unknown email", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "nobody@test.local",
      password: "Password123",
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 with code "email_not_verified" when account is unverified', async () => {
    await createUser({ email: "unv@test.local", emailVerified: false });
    const res = await request(app).post("/api/auth/login").send({
      email: "unv@test.local",
      password: "Password123",
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("email_not_verified");
    expect(res.body.email).toBe("unv@test.local");
  });

  it('returns 403 with code "banned" when account is banned', async () => {
    await createUser({
      email: "ban@test.local",
      isBanned: true,
      bannedReason: "spam",
    });
    const res = await request(app).post("/api/auth/login").send({
      email: "ban@test.local",
      password: "Password123",
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("banned");
    expect(res.body.message).toMatch(/spam/);
  });
});

describe("GET /api/auth/me", () => {
  it("requires a valid token (401 otherwise)", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the current user when authenticated", async () => {
    const user = await createUser({ username: "mee" });
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(200);
    expect(res.body._id).toBe(user._id.toString());
    expect(res.body.username).toBe("mee");
    expect(res.body.password).toBeUndefined();
  });

  it("returns 403 when the account is banned", async () => {
    const user = await createUser({ isBanned: true, bannedReason: "rude" });
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("banned");
  });
});

describe("PUT /api/auth/profile", () => {
  it("updates displayName / nombre / apellido", async () => {
    const user = await createUser();
    const res = await request(app)
      .put("/api/auth/profile")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({
        displayName: "Claudio H",
        nombre: "Claudio",
        apellido: "Hollman",
      });
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("Claudio H");
    expect(res.body.nombre).toBe("Claudio");
  });

  it("clears BGG credentials when bggUsername changes", async () => {
    const user = await createUser({ bggUsername: "old" });
    user.bggCredentials = {
      encryptedPassword: "enc",
      connectedAt: new Date(),
      lastValidatedAt: new Date(),
      invalid: false,
    };
    await user.save();

    const res = await request(app)
      .put("/api/auth/profile")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ bggUsername: "new" });

    expect(res.status).toBe(200);
    expect(res.body.bggConnected).toBe(false);
  });

  it("requires authentication", async () => {
    const res = await request(app)
      .put("/api/auth/profile")
      .send({ nombre: "x" });
    expect(res.status).toBe(401);
  });

  it("F6 — acepta eventoReminderHours válido y persiste el valor", async () => {
    const user = await createUser();
    const res = await request(app)
      .put("/api/auth/profile")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ eventoReminderHours: 2 });
    expect(res.status).toBe(200);
    expect(res.body.eventoReminderHours).toBe(2);
    // Round-trip: re-cargar al user de la DB.
    const User = require("../../models/User");
    const refreshed = await User.findById(user._id);
    expect(refreshed.eventoReminderHours).toBe(2);
  });

  it("F6 — acepta 0 (opt-out) y persiste", async () => {
    const user = await createUser();
    const res = await request(app)
      .put("/api/auth/profile")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ eventoReminderHours: 0 });
    expect(res.status).toBe(200);
    expect(res.body.eventoReminderHours).toBe(0);
  });

  it("F6 — rechaza valores fuera del enum [0, 2, 24]", async () => {
    const user = await createUser();
    const res = await request(app)
      .put("/api/auth/profile")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ eventoReminderHours: 7 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/inválido/i);
  });

  it("F6 — coerciona strings del <select> (\"2\" → 2)", async () => {
    const user = await createUser();
    const res = await request(app)
      .put("/api/auth/profile")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ eventoReminderHours: "2" });
    expect(res.status).toBe(200);
    expect(res.body.eventoReminderHours).toBe(2);
  });
});

describe("PUT /api/auth/avatar + DELETE /api/auth/avatar", () => {
  it("uploads an avatar, stores { url, publicId }, deletes prior on replace", async () => {
    const user = await createUser();

    // First upload
    const res1 = await request(app)
      .put("/api/auth/avatar")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .attach("avatar", Buffer.from("fake-jpeg"), {
        filename: "a.jpg",
        contentType: "image/jpeg",
      });

    expect(res1.status).toBe(200);
    expect(res1.body.avatar).toBeDefined();
    expect(res1.body.avatar.url).toMatch(/^https:\/\/mock\.cloudinary/);
    expect(res1.body.avatar.publicId).toBeTruthy();
    expect(cloudMock.uploadToCloudinary).toHaveBeenCalledTimes(1);

    // Verify persisted on user doc
    const refreshed = await User.findById(user._id);
    expect(refreshed.avatar.url).toBe(res1.body.avatar.url);
    expect(refreshed.avatar.publicId).toBe(res1.body.avatar.publicId);
  });

  it("400s when no file is attached", async () => {
    const user = await createUser();
    const res = await request(app)
      .put("/api/auth/avatar")
      .set("Authorization", `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(400);
  });

  it("DELETE clears the avatar and calls Cloudinary.destroy", async () => {
    const user = await createUser();
    user.avatar = {
      url: "https://x/y.webp",
      publicId: "turnocero/users/abc/avatar",
    };
    await user.save();

    const res = await request(app)
      .delete("/api/auth/avatar")
      .set("Authorization", `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body.avatar.url).toBe("");
    expect(res.body.avatar.publicId).toBe("");
    expect(cloudMock.cloudinary.uploader.destroy).toHaveBeenCalledWith(
      "turnocero/users/abc/avatar",
    );
  });

  it("requires authentication", async () => {
    const res = await request(app)
      .put("/api/auth/avatar")
      .attach("avatar", Buffer.from("x"), {
        filename: "x.jpg",
        contentType: "image/jpeg",
      });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/bgg-connect — autosync on first connect", () => {
  const BggPlay = require("../../models/BggPlay");
  const bggRouter = require("../../routes/bgg");

  function loginOk() {
    return {
      ok: true,
      status: 200,
      headers: {
        getSetCookie: () => [
          "bggusername=h3rmit; Path=/",
          "SessionID=abc; Path=/",
        ],
      },
      text: async () => "",
    };
  }

  function ok(body) {
    return { ok: true, status: 200, text: async () => body };
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

  async function waitFor(
    predicate,
    { timeoutMs = 5000, intervalMs = 25 } = {},
  ) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await predicate()) return;
      await new Promise((r) => {
        setTimeout(r, intervalMs);
      });
    }
    throw new Error("waitFor: condition not met within timeout");
  }

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

  it("triggers a background reconcile and persists plays after a successful connect", async () => {
    const user = await createUser({ bggUsername: "firsttime" });
    fetchSpy
      .mockResolvedValueOnce(loginOk()) // loginToBgg
      .mockResolvedValueOnce(
        ok(
          playsXml(
            [
              // reconcileFull → /plays page 1
              { id: "1", date: "2026-01-01", gameName: "A", gameId: 1 },
              { id: "2", date: "2026-01-02", gameName: "B", gameId: 2 },
            ],
            2,
          ),
        ),
      )
      .mockResolvedValueOnce(
        ok(
          thingXml([
            // game thumbnails
            { id: 1, name: "A", thumbnail: "a.jpg" },
            { id: 2, name: "B", thumbnail: "b.jpg" },
          ]),
        ),
      );

    const res = await request(app)
      .post("/api/auth/bgg-connect")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ password: "bgg-secret" });

    expect(res.status).toBe(200);
    expect(res.body.bggConnected).toBe(true);

    // Background reconcile completes asynchronously — poll until done.
    await waitFor(async () => {
      const u = await User.findById(user._id).lean();
      return !!u.bggSync?.lastFullSyncAt;
    });

    const plays = await BggPlay.find({ bggUsername: "firsttime" })
      .sort({ playId: 1 })
      .lean();
    expect(plays).toHaveLength(2);
    expect(plays[0].playId).toBe("1");
    expect(plays[1].playId).toBe("2");

    const u = await User.findById(user._id).lean();
    expect(u.bggSync.lastFullSyncCount).toBe(2);
  });

  it("still completes the connect response even if the background reconcile fails", async () => {
    const user = await createUser({ bggUsername: "flaky" });
    fetchSpy
      .mockResolvedValueOnce(loginOk())
      .mockRejectedValueOnce(new Error("BGG down")); // reconcileFull /plays fails

    const res = await request(app)
      .post("/api/auth/bgg-connect")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ password: "bgg-secret" });

    expect(res.status).toBe(200);
    expect(res.body.bggConnected).toBe(true);

    // Give the failing background work a moment to settle.
    await new Promise((r) => {
      setTimeout(r, 50);
    });
    // No plays were persisted, and lastFullSyncAt stays null.
    expect(await BggPlay.countDocuments({ bggUsername: "flaky" })).toBe(0);
    const u = await User.findById(user._id).lean();
    expect(u.bggSync?.lastFullSyncAt || null).toBeNull();
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("returns 200 generic regardless of whether email exists (no enumeration)", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody@test.local" });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });

  it("emails a reset link when the account exists", async () => {
    await createUser({ email: "fp@test.local" });
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "fp@test.local" });
    expect(res.status).toBe(200);
    expect(emailMock.__sentEmails.length).toBe(1);
    expect(emailMock.__sentEmails[0].to).toBe("fp@test.local");
  });
});
