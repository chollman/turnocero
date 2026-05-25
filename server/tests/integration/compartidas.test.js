const request = require("supertest");
const app = require("../../app");
const Compartida = require("../../models/Compartida");
const User = require("../../models/User");
const { createUser, createAuthedUser, tokenFor } = require("../helpers/auth");
const { createCompartida } = require("../helpers/factories");
const { loadSiteConfig, updateSiteConfig } = require("../../utils/siteConfig");
const SiteConfig = require("../../models/SiteConfig");

async function enableAllSections() {
  const all = {};
  for (const key of SiteConfig.SECTION_KEYS) all[key] = { enabled: true };
  await loadSiteConfig();
  await updateSiteConfig(all, null, null);
}

beforeEach(enableAllSections);

// The feed splits the most-liked recent post into `featured` and the rest into
// `compartidas`. Tests assert visibility via `total` + a combined view.
function visibleBodies(body) {
  const all = [...(body.compartidas || [])];
  if (body.featured) all.push(body.featured);
  return all.map((c) => c.body);
}

describe("GET /api/compartidas — privacy visibility", () => {
  it("anon sees only public posts", async () => {
    const author = await createUser();
    await createCompartida(author, { body: "Public 1", privacy: "public" });
    await createCompartida(author, {
      body: "Friends only",
      privacy: "friends",
    });
    await createCompartida(author, { body: "Private", privacy: "private" });

    const res = await request(app).get("/api/compartidas");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(visibleBodies(res.body)).toEqual(["Public 1"]);
  });

  it("friends see friends-privacy posts by friends", async () => {
    const author = await createUser();
    const { user: friend, token } = await createAuthedUser();
    author.friends = [friend._id];
    await author.save();
    await User.updateOne(
      { _id: friend._id },
      { $set: { friends: [author._id] } },
    );

    await createCompartida(author, {
      body: "Friends only",
      privacy: "friends",
    });

    const res = await request(app)
      .get("/api/compartidas")
      .set("Authorization", `Bearer ${token}`);
    expect(visibleBodies(res.body)).toContain("Friends only");
  });

  it("non-friends do NOT see friends-privacy posts", async () => {
    const author = await createUser();
    const { token } = await createAuthedUser(); // no friendship
    await createCompartida(author, {
      body: "Friends only",
      privacy: "friends",
    });

    const res = await request(app)
      .get("/api/compartidas")
      .set("Authorization", `Bearer ${token}`);
    expect(visibleBodies(res.body)).not.toContain("Friends only");
  });

  it("author always sees their own private posts", async () => {
    const { user, token } = await createAuthedUser();
    await createCompartida(user, { body: "Mine alone", privacy: "private" });

    const res = await request(app)
      .get("/api/compartidas")
      .set("Authorization", `Bearer ${token}`);
    expect(visibleBodies(res.body)).toContain("Mine alone");
  });
});

describe("POST /api/compartidas", () => {
  it("creates a compartida with the caller as author", async () => {
    const { user, token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "Hola mundo", privacy: "public" });

    expect(res.status).toBe(201);
    expect(res.body.author._id).toBe(user._id.toString());
    expect(res.body.body).toBe("Hola mundo");
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/api/compartidas").send({ body: "x" });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/compartidas/:id/like (toggle)", () => {
  it("first call likes; second call unlikes", async () => {
    const author = await createUser();
    const compartida = await createCompartida(author, { privacy: "public" });
    const { user, token } = await createAuthedUser();

    const r1 = await request(app)
      .post(`/api/compartidas/${compartida._id}/like`)
      .set("Authorization", `Bearer ${token}`);
    expect(r1.status).toBe(200);
    let refreshed = await Compartida.findById(compartida._id);
    expect(refreshed.likes.map((l) => l.toString())).toContain(
      user._id.toString(),
    );

    const r2 = await request(app)
      .post(`/api/compartidas/${compartida._id}/like`)
      .set("Authorization", `Bearer ${token}`);
    expect(r2.status).toBe(200);
    refreshed = await Compartida.findById(compartida._id);
    expect(refreshed.likes.map((l) => l.toString())).not.toContain(
      user._id.toString(),
    );
  });
});

describe("PUT/DELETE /api/compartidas/:id permissions", () => {
  it("author update persists and responds 200 with the populated doc", async () => {
    // Bug histórico (populateCompartida(Promise.resolve(doc))) arreglado en F1
    // al usar Compartida.findById(...) como Query mongoose-able.
    const { user, token } = await createAuthedUser();
    const compartida = await createCompartida(user, { body: "old" });
    const res = await request(app)
      .put(`/api/compartidas/${compartida._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "new", privacy: "public" });
    expect(res.status).toBe(200);
    expect(res.body.body).toBe("new");
    const refreshed = await Compartida.findById(compartida._id);
    expect(refreshed.body).toBe("new");
  });

  it("non-author cannot edit", async () => {
    const author = await createUser();
    const { token } = await createAuthedUser();
    const compartida = await createCompartida(author);
    const res = await request(app)
      .put(`/api/compartidas/${compartida._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "hijacked" });
    expect(res.status).toBe(403);
  });

  it("F1 — linkedEvento requiere que el user haya participado (author o reg active)", async () => {
    const Evento = require("../../models/Evento");
    const admin = await createUser({ isAdmin: true });
    const { user, token } = await createAuthedUser();
    // Evento donde el user NO participó.
    const stranger = await Evento.create({
      title: "Sin mí",
      eventDate: new Date(Date.now() + 7 * 86400000),
      author: admin._id,
      status: "open",
      location: { texto: "X", lat: null, lng: null, displayName: "" },
    });
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "hola", linkedEvento: stranger._id.toString() });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/participaste/i);
    // Evento donde sí participó (confirmed).
    const joined = await Evento.create({
      title: "Conmigo",
      eventDate: new Date(Date.now() + 7 * 86400000),
      author: admin._id,
      status: "open",
      location: { texto: "X", lat: null, lng: null, displayName: "" },
      registrations: [{ user: user._id, status: "confirmed" }],
    });
    const ok = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "hola", linkedEvento: joined._id.toString() });
    expect(ok.status).toBe(201);
    expect(ok.body.linkedEvento?._id).toBe(joined._id.toString());
    expect(ok.body.linkedEvento?.title).toBe("Conmigo");
  });

  it("F1 — rechazados NO pueden vincular el evento (status=rejected no es activo)", async () => {
    const Evento = require("../../models/Evento");
    const admin = await createUser({ isAdmin: true });
    const { user, token } = await createAuthedUser();
    const evento = await Evento.create({
      title: "X",
      eventDate: new Date(Date.now() + 7 * 86400000),
      author: admin._id,
      status: "open",
      location: { texto: "X", lat: null, lng: null, displayName: "" },
      registrations: [{ user: user._id, status: "rejected" }],
    });
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "hola", linkedEvento: evento._id.toString() });
    expect(res.status).toBe(403);
  });

  it("admin can delete any compartida", async () => {
    const author = await createUser();
    const admin = await createUser({ isAdmin: true });
    const compartida = await createCompartida(author);
    const res = await request(app)
      .delete(`/api/compartidas/${compartida._id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);
    expect(res.status).toBe(200);
    const stillThere = await Compartida.findById(compartida._id);
    expect(stillThere).toBeNull();
  });
});
