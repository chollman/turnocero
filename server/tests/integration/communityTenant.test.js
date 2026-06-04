const request = require("supertest");
const app = require("../../app");
const Community = require("../../models/Community");
const Compartida = require("../../models/Compartida");
const Notification = require("../../models/Notification");
const User = require("../../models/User");
const {
  createUser,
  createAuthedUser,
  tokenFor,
  authHeader,
} = require("../helpers/auth");
const { createCompartida } = require("../helpers/factories");

// Subdominio single-tenant: cuando llega el header X-Community-Slug de una
// comunidad con subdomainEnabled, TODO el contenido se acota a esa comunidad —
// como si las demás no existieran. Ver middleware resolveTenant/resolveCommunities.
describe("Tenant scoping — X-Community-Slug header", () => {
  let base, tenant, plain, author, basePost, tenantPost, plainPost;

  beforeEach(async () => {
    base = await Community.getBase();
    tenant = await Community.create({
      name: "Patagonia",
      slug: "patagonia",
      subdomainEnabled: true,
    });
    // Comunidad SIN subdominio habilitado → su slug en el header se ignora.
    plain = await Community.create({ name: "Plain", slug: "plain" });
    author = await createUser();
    basePost = await createCompartida(author, { body: "en base" });
    tenantPost = await createCompartida(author, {
      body: "en patagonia",
      community: tenant._id,
    });
    plainPost = await createCompartida(author, {
      body: "en plain",
      community: plain._id,
    });
  });

  const idsOf = (res) => res.body.compartidas.map((c) => String(c._id));

  it("anonymous on the tenant subdomain sees only that community's public content", async () => {
    const res = await request(app)
      .get("/api/compartidas")
      .set("X-Community-Slug", "patagonia")
      .expect(200);
    expect(idsOf(res)).toContain(String(tenantPost._id));
    expect(idsOf(res)).not.toContain(String(basePost._id));
    expect(idsOf(res)).not.toContain(String(plainPost._id));
  });

  it("forces the tenant scope even for an authed user (overrides their own memberships)", async () => {
    // Usuario base-only: en el sitio normal vería la base; en el subdominio del
    // tenant ve SOLO el tenant.
    const { token } = await createAuthedUser();
    const res = await request(app)
      .get("/api/compartidas")
      .set(authHeader(token))
      .set("X-Community-Slug", "patagonia")
      .expect(200);
    expect(idsOf(res)).toContain(String(tenantPost._id));
    expect(idsOf(res)).not.toContain(String(basePost._id));
  });

  it("ignores a slug whose community has no subdomainEnabled (falls back to main site)", async () => {
    const res = await request(app)
      .get("/api/compartidas")
      .set("X-Community-Slug", "plain")
      .expect(200);
    // Sin tenant válido → comportamiento normal: anónimo ve la base.
    expect(idsOf(res)).toContain(String(basePost._id));
    expect(idsOf(res)).not.toContain(String(plainPost._id));
    expect(idsOf(res)).not.toContain(String(tenantPost._id));
  });

  it("ignores an unknown slug (falls back to main site)", async () => {
    const res = await request(app)
      .get("/api/compartidas")
      .set("X-Community-Slug", "no-existe")
      .expect(200);
    expect(idsOf(res)).toContain(String(basePost._id));
    expect(idsOf(res)).not.toContain(String(tenantPost._id));
  });

  it("scopes the communities directory to the tenant only", async () => {
    const res = await request(app)
      .get("/api/comunidades")
      .set("X-Community-Slug", "patagonia")
      .expect(200);
    const slugs = res.body.comunidades.map((c) => c.slug);
    expect(slugs).toEqual(["patagonia"]);
  });

  it("forces created content to the tenant for a member (ignores body.community)", async () => {
    const member = await createUser({
      communityMemberships: [{ community: tenant._id, role: "member" }],
    });
    const res = await request(app)
      .post("/api/compartidas")
      .set(authHeader(tokenFor(member)))
      .set("X-Community-Slug", "patagonia")
      // Intenta publicar en la base, pero el subdominio fuerza el tenant.
      .send({ category: "juntada", body: "x", community: base._id.toString() })
      .expect(201);
    const created = await Compartida.findById(res.body._id);
    expect(String(created.community)).toBe(String(tenant._id));
  });

  it("rejects content creation by a non-member on the tenant (vidriera read-only → 403)", async () => {
    const { token } = await createAuthedUser(); // base-only, no es miembro del tenant
    await request(app)
      .post("/api/compartidas")
      .set(authHeader(token))
      .set("X-Community-Slug", "patagonia")
      .send({ category: "juntada", body: "x" })
      .expect(403);
  });
});

// GET /api/notifications en modo tenant: solo notifs de contenido de esa
// comunidad + las personales (dm/amistad/admin-chat) que se ven siempre.
describe("Tenant scoping — GET /api/notifications", () => {
  let base, tenant, plain, recipient, token;

  beforeEach(async () => {
    base = await Community.getBase();
    tenant = await Community.create({
      name: "Patagonia",
      slug: "patagonia",
      subdomainEnabled: true,
    });
    plain = await Community.create({ name: "Plain", slug: "plain" });
    const authed = await createAuthedUser();
    recipient = authed.user;
    token = authed.token;

    await Notification.create([
      // Contenido del tenant → debe verse en el subdominio.
      {
        recipient: recipient._id,
        type: "comment",
        tableId: "t-tenant",
        community: String(tenant._id),
      },
      // Contenido de otra comunidad → NO debe verse en el subdominio.
      {
        recipient: recipient._id,
        type: "comment",
        tableId: "t-base",
        community: String(base._id),
      },
      {
        recipient: recipient._id,
        type: "comment",
        tableId: "t-plain",
        community: String(plain._id),
      },
      // Personal (dm) → se ve siempre, también en el subdominio.
      {
        recipient: recipient._id,
        type: "dm",
        fromUserId: "u-friend",
        community: null,
      },
      // Legacy de contenido sin community → oculto en el subdominio.
      {
        recipient: recipient._id,
        type: "comment",
        tableId: "t-legacy",
        community: null,
      },
    ]);
  });

  const tableIdsOf = (res) => res.body.map((n) => n.tableId).filter(Boolean);
  const typesOf = (res) => res.body.map((n) => n.type);

  it("on the tenant subdomain returns only that community's content + personal notifs", async () => {
    const res = await request(app)
      .get("/api/notifications")
      .set(authHeader(token))
      .set("X-Community-Slug", "patagonia")
      .expect(200);
    expect(tableIdsOf(res)).toContain("t-tenant");
    expect(tableIdsOf(res)).not.toContain("t-base");
    expect(tableIdsOf(res)).not.toContain("t-plain");
    expect(tableIdsOf(res)).not.toContain("t-legacy");
    // El dm personal pasa.
    expect(typesOf(res)).toContain("dm");
  });

  it("on the main site (no tenant header) returns all of the user's notifs", async () => {
    const res = await request(app)
      .get("/api/notifications")
      .set(authHeader(token))
      .expect(200);
    expect(tableIdsOf(res)).toEqual(
      expect.arrayContaining(["t-tenant", "t-base", "t-plain", "t-legacy"]),
    );
    expect(typesOf(res)).toContain("dm");
  });

  it("ignores a slug whose community has no subdomainEnabled (no scoping)", async () => {
    const res = await request(app)
      .get("/api/notifications")
      .set(authHeader(token))
      .set("X-Community-Slug", "plain")
      .expect(200);
    // Sin tenant válido → comportamiento normal: ve todo.
    expect(tableIdsOf(res)).toEqual(
      expect.arrayContaining(["t-tenant", "t-base", "t-plain"]),
    );
  });
});

// Auto-join al tenant: registrarse o loguearse desde un subdominio de comunidad
// agrega al usuario como miembro de esa comunidad, sin importar su joinPolicy.
describe("Tenant auto-join on auth", () => {
  const mkTenant = () =>
    Community.create({
      name: "Patagonia",
      slug: "patagonia",
      subdomainEnabled: true,
      joinPolicy: "approval", // el caso clave: aprobación NO debe frenar el auto-join
    });

  const memberIds = (u) =>
    u.communityMemberships.map((m) => String(m.community));

  it("login from a community subdomain joins the user (ignores approval policy)", async () => {
    const tenant = await mkTenant();
    const user = await createUser(); // verificado, password "Password123", no miembro

    await request(app)
      .post("/api/auth/login")
      .set("X-Community-Slug", "patagonia")
      .send({ email: user.email, password: "Password123" })
      .expect(200);

    const reloaded = await User.findById(user._id);
    expect(memberIds(reloaded)).toContain(String(tenant._id));
  });

  it("login on the main site (no tenant header) does NOT auto-join", async () => {
    const tenant = await mkTenant();
    const user = await createUser();

    await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "Password123" })
      .expect(200);

    const reloaded = await User.findById(user._id);
    expect(memberIds(reloaded)).not.toContain(String(tenant._id));
  });

  it("register from a community subdomain joins the new user", async () => {
    const tenant = await mkTenant();

    await request(app)
      .post("/api/auth/register")
      .set("X-Community-Slug", "patagonia")
      .send({
        username: "nuevo_tenant",
        email: "nuevo_tenant@test.local",
        password: "Password123",
      })
      .expect(201);

    const created = await User.findOne({ email: "nuevo_tenant@test.local" });
    expect(memberIds(created)).toContain(String(tenant._id));
  });
});
