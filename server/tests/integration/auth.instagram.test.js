const request = require("supertest");

process.env.FB_APP_ID = "test-fb-app";
process.env.FB_APP_SECRET = "test-fb-secret";

const app = require("../../app");
const User = require("../../models/User");
const { createUser, tokenFor } = require("../helpers/auth");

const REQUIRED_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
];

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

// Stubea el flujo completo: debug_token → oauth/access_token (exchange) →
// me/accounts → {page-id} (instagram_business_account) → {ig-user-id} (username).
function stubInstagramFetch({
  validToken = true,
  scopes = REQUIRED_SCOPES,
  hasIgPage = true,
} = {}) {
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes("/debug_token")) {
      return jsonResponse({
        data: {
          is_valid: validToken,
          app_id: process.env.FB_APP_ID,
          scopes,
        },
      });
    }
    if (u.includes("/oauth/access_token")) {
      return jsonResponse({ access_token: "long-lived-token", expires_in: 5184000 });
    }
    if (u.includes("/me/accounts")) {
      return jsonResponse({
        data: [{ id: "page-1", name: "Mi Página", access_token: "page-token-1" }],
      });
    }
    if (u.includes("/page-1")) {
      return jsonResponse({
        instagram_business_account: hasIgPage ? { id: "ig-user-1" } : undefined,
      });
    }
    if (u.includes("/ig-user-1")) {
      return jsonResponse({ username: "mesa.de.juegos" });
    }
    throw new Error(`unexpected url in test: ${u}`);
  });
}

afterEach(() => {
  delete global.fetch;
});

describe("POST /api/auth/instagram-connect", () => {
  it("validates, resolves the IG page, and stores the encrypted page token", async () => {
    stubInstagramFetch();
    const user = await createUser();

    const res = await request(app)
      .post("/api/auth/instagram-connect")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ accessToken: "short-lived-token" });

    expect(res.status).toBe(200);
    expect(res.body.instagramConnected).toBe(true);
    expect(res.body.instagramUsername).toBe("mesa.de.juegos");
    expect(res.body.instagramInvalid).toBe(false);
    // El token cifrado nunca sale al cliente, ni el subdocumento crudo.
    expect(res.body.instagramCredentials).toBeUndefined();

    const stored = await User.findById(user._id);
    expect(stored.instagramCredentials.encryptedPageAccessToken).not.toBe("");
    expect(stored.instagramCredentials.encryptedPageAccessToken).not.toBe(
      "page-token-1",
    );
    expect(stored.instagramCredentials.igUserId).toBe("ig-user-1");
    expect(stored.instagramCredentials.pageId).toBe("page-1");
  });

  it("400s without persisting when no Page has an Instagram Business account linked", async () => {
    stubInstagramFetch({ hasIgPage: false });
    const user = await createUser();

    const res = await request(app)
      .post("/api/auth/instagram-connect")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ accessToken: "short-lived-token" });

    expect(res.status).toBe(400);
    const stored = await User.findById(user._id);
    expect(stored.instagramCredentials.encryptedPageAccessToken).toBe("");
  });

  it("401s when the Facebook token is invalid", async () => {
    stubInstagramFetch({ validToken: false });
    const user = await createUser();

    const res = await request(app)
      .post("/api/auth/instagram-connect")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ accessToken: "bad-token" });

    expect(res.status).toBe(401);
  });

  it("400s when the granted scopes are missing instagram_content_publish", async () => {
    stubInstagramFetch({ scopes: ["instagram_basic", "pages_show_list"] });
    const user = await createUser();

    const res = await request(app)
      .post("/api/auth/instagram-connect")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ accessToken: "short-lived-token" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/instagram_content_publish/);
  });

  it("400s when accessToken is missing from the body", async () => {
    const user = await createUser();
    const res = await request(app)
      .post("/api/auth/instagram-connect")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("401s without a valid session token", async () => {
    const res = await request(app)
      .post("/api/auth/instagram-connect")
      .send({ accessToken: "short-lived-token" });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/auth/instagram-connection", () => {
  it("clears the stored credentials", async () => {
    stubInstagramFetch();
    const user = await createUser();
    await request(app)
      .post("/api/auth/instagram-connect")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ accessToken: "short-lived-token" });

    const res = await request(app)
      .delete("/api/auth/instagram-connection")
      .set("Authorization", `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body.instagramConnected).toBe(false);

    const stored = await User.findById(user._id);
    expect(stored.instagramCredentials.encryptedPageAccessToken).toBe("");
    expect(stored.instagramCredentials.igUserId).toBe("");
  });
});
