const request = require("supertest");
const app = require("../../app");
const Community = require("../../models/Community");
const Compartida = require("../../models/Compartida");
const {
  createUser,
  createAuthedUser,
  tokenFor,
  authHeader,
} = require("../helpers/auth");
const { createCompartida, createTable } = require("../helpers/factories");

describe("Community read-scoping — compartidas", () => {
  let base, beta, basePost, betaPost, author;

  beforeEach(async () => {
    base = await Community.getBase();
    beta = await Community.create({ name: "Beta", slug: "beta" });
    author = await createUser();
    basePost = await createCompartida(author, { body: "en base" });
    betaPost = await createCompartida(author, {
      body: "en beta",
      community: beta._id,
    });
  });

  const idsOf = (res) => res.body.compartidas.map((c) => String(c._id));

  it("anonymous sees only base-community content", async () => {
    const res = await request(app).get("/api/compartidas").expect(200);
    expect(idsOf(res)).toContain(String(basePost._id));
    expect(idsOf(res)).not.toContain(String(betaPost._id));
  });

  it("a base-only member does not see another community's content", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .get("/api/compartidas")
      .set(authHeader(token))
      .expect(200);
    expect(idsOf(res)).toContain(String(basePost._id));
    expect(idsOf(res)).not.toContain(String(betaPost._id));
  });

  it("a member viewing Beta sees Beta content and not base", async () => {
    const viewer = await createUser({
      communityMemberships: [{ community: beta._id, role: "member" }],
      communityPrefs: { viewing: [beta._id], skin: beta._id },
    });
    const res = await request(app)
      .get("/api/compartidas")
      .set(authHeader(tokenFor(viewer)))
      .expect(200);
    expect(idsOf(res)).toContain(String(betaPost._id));
    expect(idsOf(res)).not.toContain(String(basePost._id));
  });

  it("POST without a community defaults to the author's base community", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/compartidas")
      .set(authHeader(token))
      .send({ category: "juntada", body: "nueva" })
      .expect(201);
    const created = await Compartida.findById(res.body._id);
    expect(String(created.community)).toBe(String(base._id));
  });
});

describe("Community scoping — /mine and event tables are NOT scoped", () => {
  it("the global mesas list is scoped but /mine returns the user's own tables across communities", async () => {
    const beta = await Community.create({ name: "Beta2", slug: "beta2" });
    // Admin bypasea el requireSection('mesas') (default off para no-admins).
    const { user: admin, token } = await createAuthedUser({ isAdmin: true });
    const baseTable = await createTable(admin);
    const betaTable = await createTable(admin, { community: beta._id });

    // Lista global: scopeada a la base (admin sin memberships → viewing=[base]).
    const list = await request(app)
      .get("/api/tables")
      .set(authHeader(token))
      .expect(200);
    const listIds = list.body.tables.map((t) => String(t._id));
    expect(listIds).toContain(String(baseTable._id));
    expect(listIds).not.toContain(String(betaTable._id));

    // /mine: NO scopeado — devuelve las mesas propias de cualquier comunidad.
    const mine = await request(app)
      .get("/api/tables/mine")
      .set(authHeader(token))
      .expect(200);
    const mineIds = mine.body.tables.map((t) => String(t._id));
    expect(mineIds).toContain(String(baseTable._id));
    expect(mineIds).toContain(String(betaTable._id));
  });
});
