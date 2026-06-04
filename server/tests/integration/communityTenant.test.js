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
