const request = require("supertest");
const app = require("../../app");
const Idea = require("../../models/Idea");
const { createAuthedUser } = require("../helpers/auth");
const {
  loadSiteConfig,
  updateSiteConfig,
} = require("../../utils/siteConfig");

beforeEach(async () => {
  await loadSiteConfig();
});

describe("POST /api/ideas", () => {
  it("creates an idea as guest without email", async () => {
    const res = await request(app)
      .post("/api/ideas")
      .send({ content: "Estaría bueno poder ordenar las mesas por distancia." });
    expect(res.status).toBe(201);
    const all = await Idea.find();
    expect(all).toHaveLength(1);
    expect(all[0].fromUser).toBeNull();
    expect(all[0].fromEmail).toBeNull();
    expect(all[0].status).toBe("new");
  });

  it("stores guest email when provided", async () => {
    const res = await request(app)
      .post("/api/ideas")
      .send({
        content: "Sería groso un feed RSS para las noticias.",
        email: "Pepe@Test.LOCAL",
      });
    expect(res.status).toBe(201);
    const doc = await Idea.findOne();
    expect(doc.fromEmail).toBe("pepe@test.local");
  });

  it("400s on too-short content", async () => {
    const res = await request(app)
      .post("/api/ideas")
      .send({ content: "hola" });
    expect(res.status).toBe(400);
    expect(await Idea.countDocuments()).toBe(0);
  });

  it("400s on content over 2000 chars", async () => {
    const res = await request(app)
      .post("/api/ideas")
      .send({ content: "x".repeat(2001) });
    expect(res.status).toBe(400);
    expect(await Idea.countDocuments()).toBe(0);
  });

  it("400s on invalid email", async () => {
    const res = await request(app)
      .post("/api/ideas")
      .send({
        content: "Idea suficientemente larga.",
        email: "no-es-email",
      });
    expect(res.status).toBe(400);
  });

  it("sets fromUser and ignores email when authed", async () => {
    const { user, token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/ideas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        content: "Quiero poder marcar mis juegos favoritos.",
        email: "spam@evil.local",
      });
    expect(res.status).toBe(201);
    const doc = await Idea.findOne();
    expect(doc.fromUser.toString()).toBe(user._id.toString());
    expect(doc.fromEmail).toBeNull();
  });

  it("returns 403 when section is disabled (for non-admins)", async () => {
    await updateSiteConfig({ colabora: { enabled: false } }, null);
    const res = await request(app)
      .post("/api/ideas")
      .send({ content: "Una idea pertinente que no debería pasar." });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("section_disabled");
  });
});

describe("GET /api/ideas (admin only)", () => {
  it("403s for non-admins", async () => {
    const { token } = await createAuthedUser({ isAdmin: false });
    const res = await request(app)
      .get("/api/ideas")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("401s without token", async () => {
    const res = await request(app).get("/api/ideas");
    expect(res.status).toBe(401);
  });

  it("returns paginated ideas with counts", async () => {
    await Idea.create([
      { content: "Idea uno bien larga para pasar el min." },
      { content: "Idea dos también razonable.", status: "reviewed" },
      { content: "Idea tres archivada acá.", status: "archived" },
    ]);
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .get("/api/ideas")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ideas).toHaveLength(3);
    expect(res.body.total).toBe(3);
    expect(res.body.counts).toEqual({ new: 1, reviewed: 1, archived: 1 });
  });

  it("filters by status", async () => {
    await Idea.create([
      { content: "Una idea común y silvestre." },
      { content: "Otra revisada por el equipo.", status: "reviewed" },
    ]);
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .get("/api/ideas?status=reviewed")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ideas).toHaveLength(1);
    expect(res.body.ideas[0].status).toBe("reviewed");
  });

  it("400s on invalid status filter", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .get("/api/ideas?status=cualquier-cosa")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/ideas/:id (admin only)", () => {
  it("updates the status", async () => {
    const idea = await Idea.create({
      content: "Idea para pasar a revisada.",
    });
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .patch(`/api/ideas/${idea._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "reviewed" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("reviewed");
    const reloaded = await Idea.findById(idea._id);
    expect(reloaded.status).toBe("reviewed");
  });

  it("400s on invalid status", async () => {
    const idea = await Idea.create({ content: "Idea para fallar test." });
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .patch(`/api/ideas/${idea._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "trash" });
    expect(res.status).toBe(400);
  });

  it("404s on missing idea", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .patch("/api/ideas/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "reviewed" });
    expect(res.status).toBe(404);
  });

  it("400s on malformed id", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .patch("/api/ideas/not-an-id")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "reviewed" });
    expect(res.status).toBe(400);
  });

  it("403s for non-admins", async () => {
    const idea = await Idea.create({ content: "Una idea cualquiera nomás." });
    const { token } = await createAuthedUser({ isAdmin: false });
    const res = await request(app)
      .patch(`/api/ideas/${idea._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "reviewed" });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/ideas/:id (admin only)", () => {
  it("hard-deletes the idea", async () => {
    const idea = await Idea.create({ content: "Idea condenada al delete." });
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .delete(`/api/ideas/${idea._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(await Idea.findById(idea._id)).toBeNull();
  });

  it("404s on missing idea", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .delete("/api/ideas/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("403s for non-admins", async () => {
    const idea = await Idea.create({ content: "Idea protegida por el rol." });
    const { token } = await createAuthedUser({ isAdmin: false });
    const res = await request(app)
      .delete(`/api/ideas/${idea._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
