const request = require("supertest");
const app = require("../../app");
const User = require("../../models/User");
const { createAuthedUser, createUser, authHeader } = require("../helpers/auth");

// Usuarios habilitados para features en piloto (config/betaFeatures.js),
// administrados desde /panel-admin.

const base = "/api/admin/beta/bgwatchAgent/usuarios";

describe("admin beta feature users", () => {
  it("requires an admin", async () => {
    const anon = await request(app).get(base);
    expect(anon.status).toBe(401);
    const { token } = await createAuthedUser();
    const res = await request(app).get(base).set(authHeader(token));
    expect(res.status).toBe(403);
    const target = await createUser();
    const put = await request(app)
      .put(`${base}/${target._id}`)
      .set(authHeader(token));
    expect(put.status).toBe(403);
  });

  it("rejects unknown features and bad ids", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .get("/api/admin/beta/mesas/usuarios")
      .set(authHeader(token));
    expect(res.status).toBe(400);
    const bad = await request(app).put(`${base}/nope`).set(authHeader(token));
    expect(bad.status).toBe(400);
  });

  it("404s for a missing user", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .put(`${base}/507f1f77bcf86cd799439011`)
      .set(authHeader(token));
    expect(res.status).toBe(404);
  });

  it("adds idempotently, lists and removes users", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const zoe = await createUser({ username: "zoe" });
    const ana = await createUser({ username: "Ana" });
    await createUser({ username: "other" });

    for (const u of [zoe, ana, zoe]) {
      const res = await request(app)
        .put(`${base}/${u._id}`)
        .set(authHeader(token));
      expect(res.status).toBe(200);
      expect(res.body.username).toBe(u.username);
    }
    const stored = await User.findById(zoe._id).lean();
    expect(stored.betaFeatures).toEqual(["bgwatchAgent"]);

    const list = await request(app).get(base).set(authHeader(token));
    expect(list.status).toBe(200);
    expect(list.body.map((u) => u.username)).toEqual(["Ana", "zoe"]);
    expect(list.body[0]).not.toHaveProperty("email");

    const del = await request(app)
      .delete(`${base}/${zoe._id}`)
      .set(authHeader(token));
    expect(del.status).toBe(200);
    const after = await request(app).get(base).set(authHeader(token));
    expect(after.body.map((u) => u.username)).toEqual(["Ana"]);
  });

  it("shows the flag on /auth/me but not on the public profile", async () => {
    const { user, token } = await createAuthedUser({
      betaFeatures: ["bgwatchAgent"],
    });
    const me = await request(app).get("/api/auth/me").set(authHeader(token));
    expect(me.status).toBe(200);
    const meUser = me.body.user || me.body;
    expect(meUser.betaFeatures).toEqual(["bgwatchAgent"]);

    const pub = await request(app).get(`/api/users/${user._id}`);
    expect(pub.status).toBe(200);
    expect(JSON.stringify(pub.body)).not.toContain("betaFeatures");
  });

  it("rejects values outside the allowed features", async () => {
    await expect(createUser({ betaFeatures: ["mesas"] })).rejects.toThrow();
  });
});
