const request = require("supertest");
const jwt = require("jsonwebtoken");

// Config OAuth de test — seteada antes de requerir la app (la ruta lee
// process.env en runtime, pero lo dejamos explícito).
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.FB_APP_ID = "test-fb-app";
process.env.FB_APP_SECRET = "test-fb-secret";

// Mock de google-auth-library vía require.cache ANTES de requerir la app.
// (vi.mock no intercepta CommonJS require() de forma fiable en vitest 4 — el
// resto del repo usa este mismo patrón de monkeypatch; ver tests/setup.js.)
const mockVerifyIdToken = vi.fn();
const galPath = require.resolve("google-auth-library");
class MockOAuth2Client {
  verifyIdToken(...args) {
    return mockVerifyIdToken(...args);
  }
}
require.cache[galPath] = {
  id: galPath,
  filename: galPath,
  loaded: true,
  exports: { OAuth2Client: MockOAuth2Client },
};

const app = require("../../app");
const User = require("../../models/User");

function googlePayload(overrides = {}) {
  return {
    sub: "g-sub-1",
    email: "oauth@test.local",
    email_verified: true,
    name: "OAuth User",
    picture: "https://pic/avatar.jpg",
    ...overrides,
  };
}

// Helper: stubea global.fetch para el flujo de Facebook (debug_token + me).
function stubFacebookFetch({ debug, profile } = {}) {
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes("debug_token")) {
      return {
        json: async () => ({
          data: debug ?? {
            is_valid: true,
            app_id: process.env.FB_APP_ID,
          },
        }),
      };
    }
    // /me
    return {
      json: async () =>
        profile ?? {
          id: "fb-1",
          name: "FB User",
          email: "fbuser@test.local",
        },
    };
  });
}

beforeEach(() => {
  mockVerifyIdToken.mockReset();
});

describe("POST /api/auth/oauth/google", () => {
  it("creates a verified, password-less account and returns { user, token }", async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => googlePayload(),
    });

    const res = await request(app)
      .post("/api/auth/oauth/google")
      .send({ credential: "fake-id-token" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe("oauth@test.local");
    expect(res.body.user.emailVerified).toBe(true);
    expect(res.body.user.authProviders).toEqual(["google"]);
    // toJSON nunca expone el id de proveedor ni la password.
    expect(res.body.user.googleId).toBeUndefined();
    expect(res.body.user.password).toBeUndefined();

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.id).toBe(res.body.user._id);

    const inDb = await User.findOne({ email: "oauth@test.local" });
    expect(inDb.googleId).toBe("g-sub-1");
  });

  it("reuses the same account on a second login", async () => {
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => googlePayload() });
    await request(app)
      .post("/api/auth/oauth/google")
      .send({ credential: "t1" });
    await request(app)
      .post("/api/auth/oauth/google")
      .send({ credential: "t2" });
    expect(await User.countDocuments()).toBe(1);
  });

  it("links to an existing password account with the same email", async () => {
    const existing = await User.create({
      username: "preexisting",
      email: "oauth@test.local",
      password: "Password1",
      emailVerified: false,
    });
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => googlePayload() });

    const res = await request(app)
      .post("/api/auth/oauth/google")
      .send({ credential: "t" });

    expect(res.status).toBe(200);
    expect(res.body.user._id).toBe(existing._id.toString());
    expect(await User.countDocuments()).toBe(1);
    const inDb = await User.findById(existing._id);
    expect(inDb.googleId).toBe("g-sub-1");
    expect(inDb.emailVerified).toBe(true);
  });

  it("rejects a token whose email is not verified", async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => googlePayload({ email_verified: false }),
    });
    const res = await request(app)
      .post("/api/auth/oauth/google")
      .send({ credential: "t" });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid token", async () => {
    mockVerifyIdToken.mockRejectedValue(new Error("bad token"));
    const res = await request(app)
      .post("/api/auth/oauth/google")
      .send({ credential: "t" });
    expect(res.status).toBe(401);
  });

  it("400 when credential is missing", async () => {
    const res = await request(app).post("/api/auth/oauth/google").send({});
    expect(res.status).toBe(400);
  });

  it("403 with code:banned for a banned linked account", async () => {
    await User.create({
      username: "bannedguy",
      email: "oauth@test.local",
      password: "Password1",
      isBanned: true,
      bannedReason: "spam",
    });
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => googlePayload() });
    const res = await request(app)
      .post("/api/auth/oauth/google")
      .send({ credential: "t" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("banned");
  });
});

describe("POST /api/auth/oauth/facebook", () => {
  afterEach(() => {
    delete global.fetch;
  });

  it("creates an account from a valid access token", async () => {
    stubFacebookFetch();
    const res = await request(app)
      .post("/api/auth/oauth/facebook")
      .send({ accessToken: "fb-token" });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("fbuser@test.local");
    expect(res.body.user.authProviders).toEqual(["facebook"]);
    const inDb = await User.findOne({ email: "fbuser@test.local" });
    expect(inDb.facebookId).toBe("fb-1");
  });

  it("rejects when debug_token reports an invalid token", async () => {
    stubFacebookFetch({ debug: { is_valid: false } });
    const res = await request(app)
      .post("/api/auth/oauth/facebook")
      .send({ accessToken: "fb-token" });
    expect(res.status).toBe(401);
  });

  it("rejects when the token belongs to another app", async () => {
    stubFacebookFetch({ debug: { is_valid: true, app_id: "someone-else" } });
    const res = await request(app)
      .post("/api/auth/oauth/facebook")
      .send({ accessToken: "fb-token" });
    expect(res.status).toBe(401);
  });

  it("400 when Facebook does not return an email", async () => {
    stubFacebookFetch({ profile: { id: "fb-2", name: "No Email" } });
    const res = await request(app)
      .post("/api/auth/oauth/facebook")
      .send({ accessToken: "fb-token" });
    expect(res.status).toBe(400);
  });

  it("400 when accessToken is missing", async () => {
    const res = await request(app).post("/api/auth/oauth/facebook").send({});
    expect(res.status).toBe(400);
  });
});
