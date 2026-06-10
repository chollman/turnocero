const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../../app");
const ShortLink = require("../../models/ShortLink");
const { createAuthedUser, authHeader } = require("../helpers/auth");
const {
  createCompartida,
  createEvento,
  createNoticia,
} = require("../helpers/factories");

describe("POST /api/shortlinks — get-or-create", () => {
  it("creates a short link for a public compartida", async () => {
    const { user } = await createAuthedUser();
    const post = await createCompartida(user, { privacy: "public" });

    const res = await request(app)
      .post("/api/shortlinks")
      .send({ type: "compartida", ref: post._id.toString() })
      .expect(201);

    expect(res.body.code).toMatch(/^[A-Za-z0-9]+$/);
    expect(res.body.path).toBe(`/compartidas/${post._id}`);
  });

  it("works for anonymous visitors (optionalAuth) on public content", async () => {
    const { user } = await createAuthedUser();
    const post = await createCompartida(user, { privacy: "public" });

    // Sin authHeader → anónimo.
    await request(app)
      .post("/api/shortlinks")
      .send({ type: "compartida", ref: post._id.toString() })
      .expect(201);
  });

  it("dedups: the same resource returns the same code and one doc", async () => {
    const { user, token } = await createAuthedUser();
    const post = await createCompartida(user, { privacy: "public" });

    const a = await request(app)
      .post("/api/shortlinks")
      .set(authHeader(token))
      .send({ type: "compartida", ref: post._id.toString() })
      .expect(201);
    const b = await request(app)
      .post("/api/shortlinks")
      .set(authHeader(token))
      .send({ type: "compartida", ref: post._id.toString() })
      .expect(201);

    expect(a.body.code).toBe(b.body.code);
    expect(await ShortLink.countDocuments({ type: "compartida" })).toBe(1);
  });

  it("400s on an invalid type", async () => {
    const post = await (async () => {
      const { user } = await createAuthedUser();
      return createCompartida(user);
    })();
    await request(app)
      .post("/api/shortlinks")
      .send({ type: "bogus", ref: post._id.toString() })
      .expect(400);
  });

  it("400s on a non-ObjectId ref for a document-backed type", async () => {
    await request(app)
      .post("/api/shortlinks")
      .send({ type: "compartida", ref: "not-an-id" })
      .expect(400);
  });

  it("404s when the compartida does not exist", async () => {
    await request(app)
      .post("/api/shortlinks")
      .send({
        type: "compartida",
        ref: new mongoose.Types.ObjectId().toString(),
      })
      .expect(404);
  });

  it("404s when the compartida is not public", async () => {
    const { user } = await createAuthedUser();
    const post = await createCompartida(user, { privacy: "private" });
    await request(app)
      .post("/api/shortlinks")
      .send({ type: "compartida", ref: post._id.toString() })
      .expect(404);
  });

  it("creates a short link for an open evento", async () => {
    const { user } = await createAuthedUser();
    const evento = await createEvento(user, { status: "open" });
    const res = await request(app)
      .post("/api/shortlinks")
      .send({ type: "evento", ref: evento._id.toString() })
      .expect(201);
    expect(res.body.path).toBe(`/eventos/${evento._id}`);
  });

  it("404s for a draft evento", async () => {
    const { user } = await createAuthedUser();
    const evento = await createEvento(user, { status: "draft" });
    await request(app)
      .post("/api/shortlinks")
      .send({ type: "evento", ref: evento._id.toString() })
      .expect(404);
  });

  it("creates a short link for a noticia", async () => {
    const { user } = await createAuthedUser({ isAdmin: true });
    const noticia = await createNoticia(user);
    const res = await request(app)
      .post("/api/shortlinks")
      .send({ type: "noticia", ref: noticia._id.toString() })
      .expect(201);
    expect(res.body.path).toBe(`/noticias/${noticia._id}`);
  });

  it("creates a short link for a bgwatch profile (no document needed)", async () => {
    const res = await request(app)
      .post("/api/shortlinks")
      .send({ type: "bgwatch", ref: "claudioBGG" })
      .expect(201);
    expect(res.body.path).toBe("/bg-watch/claudioBGG");
  });

  it("creates a short link for a partida (ref '<user>/<playId>')", async () => {
    const res = await request(app)
      .post("/api/shortlinks")
      .send({ type: "partida", ref: "claudioBGG/12345" })
      .expect(201);
    expect(res.body.path).toBe("/bg-watch/claudioBGG/partidas/12345");
  });

  it("400s on a malformed partida ref", async () => {
    await request(app)
      .post("/api/shortlinks")
      .send({ type: "partida", ref: "soloUsuario" })
      .expect(400);
  });
});

describe("GET /api/shortlinks/:code — resolve", () => {
  it("resolves to the target and increments clicks", async () => {
    const { user } = await createAuthedUser();
    const post = await createCompartida(user, { privacy: "public" });
    const { body } = await request(app)
      .post("/api/shortlinks")
      .send({ type: "compartida", ref: post._id.toString() })
      .expect(201);

    const res = await request(app)
      .get(`/api/shortlinks/${body.code}`)
      .expect(200);
    expect(res.body).toEqual({
      type: "compartida",
      ref: post._id.toString(),
      path: `/compartidas/${post._id}`,
    });

    await request(app).get(`/api/shortlinks/${body.code}`).expect(200);
    const doc = await ShortLink.findOne({ code: body.code });
    expect(doc.clicks).toBe(2);
  });

  it("404s on an unknown code", async () => {
    await request(app).get("/api/shortlinks/zzzNope1").expect(404);
  });
});
