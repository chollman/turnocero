const request = require("supertest");
const app = require("../../app");
const Community = require("../../models/Community");
const {
  createUser,
  createAuthedUser,
  authHeader,
} = require("../helpers/auth");
const { loadSiteConfig, updateSiteConfig } = require("../../utils/siteConfig");
const SiteConfig = require("../../models/SiteConfig");

async function enableAllSections() {
  const all = {};
  for (const key of SiteConfig.SECTION_KEYS) all[key] = { enabled: true };
  await loadSiteConfig();
  await updateSiteConfig(all, null, null);
}

async function disableSection(key) {
  await updateSiteConfig({ [key]: { enabled: false } }, null, null);
}

beforeEach(enableAllSections);

// Crea una comunidad + un usuario miembro de ella (membership directo).
async function communityWithMember(overrides = {}) {
  const community = await Community.create({
    name: overrides.name || "Rosario Juega",
    slug: overrides.slug || "rosario-juega",
    joinPolicy: "open",
    ...(overrides.sections ? { sections: overrides.sections } : {}),
  });
  const { user, token } = await createAuthedUser({
    communityMemberships: [{ community: community._id, role: "member" }],
  });
  return { community, user, token };
}

describe("GET /api/users — infra compartida (sin ?community)", () => {
  it("lista usuarios sin gate de sección (200) aunque `comunidad` esté off", async () => {
    await createUser({ username: "alpha_player" });
    const { token } = await createAuthedUser();
    await disableSection("comunidad");

    const res = await request(app)
      .get("/api/users")
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it("soporta búsqueda con ?search", async () => {
    await createUser({ username: "carcassonne_fan" });
    const { token } = await createAuthedUser();
    const res = await request(app)
      .get("/api/users")
      .query({ search: "carcassonne" })
      .set(authHeader(token))
      .expect(200);
    expect(res.body.some((u) => u.username === "carcassonne_fan")).toBe(true);
  });
});

describe("GET /api/users?community=<id> — miembros de una comunidad", () => {
  it("un miembro ve solo los miembros de esa comunidad", async () => {
    const { community, user, token } = await communityWithMember();
    // Otro miembro de la misma comunidad.
    const otherMember = await createUser({
      username: "otro_miembro",
      communityMemberships: [{ community: community._id, role: "member" }],
    });
    // Un usuario que NO integra la comunidad.
    await createUser({ username: "ajeno" });

    const res = await request(app)
      .get("/api/users")
      .query({ community: String(community._id) })
      .set(authHeader(token))
      .expect(200);

    const ids = res.body.map((u) => String(u._id));
    expect(ids).toContain(String(user._id));
    expect(ids).toContain(String(otherMember._id));
    expect(res.body.some((u) => u.username === "ajeno")).toBe(false);
  });

  it("un NO miembro recibe 403", async () => {
    const { community } = await communityWithMember();
    const { token: outsiderToken } = await createAuthedUser();
    await request(app)
      .get("/api/users")
      .query({ community: String(community._id) })
      .set(authHeader(outsiderToken))
      .expect(403);
  });

  it("anónimo recibe 403", async () => {
    const { community } = await communityWithMember();
    await request(app)
      .get("/api/users")
      .query({ community: String(community._id) })
      .expect(403);
  });

  it("403 cuando `comunidad` está deshabilitada globalmente (miembro)", async () => {
    const { community, token } = await communityWithMember();
    await disableSection("comunidad");
    await request(app)
      .get("/api/users")
      .query({ community: String(community._id) })
      .set(authHeader(token))
      .expect(403);
  });

  it("403 cuando la comunidad tiene su toggle `comunidad` en false", async () => {
    const { community, token } = await communityWithMember({
      sections: { comunidad: false },
    });
    await request(app)
      .get("/api/users")
      .query({ community: String(community._id) })
      .set(authHeader(token))
      .expect(403);
  });

  it("400 con un community id inválido", async () => {
    const { token } = await createAuthedUser();
    await request(app)
      .get("/api/users")
      .query({ community: "no-es-un-objectid" })
      .set(authHeader(token))
      .expect(400);
  });

  it("404 cuando la comunidad no existe", async () => {
    const { token } = await createAuthedUser();
    await request(app)
      .get("/api/users")
      .query({ community: "60f000000000000000000000" })
      .set(authHeader(token))
      .expect(404);
  });

  it("admin bypassea todos los gates (no miembro, sección off, toggle off)", async () => {
    const { community } = await communityWithMember({
      sections: { comunidad: false },
    });
    const { token: adminToken } = await createAuthedUser({ isAdmin: true });
    await disableSection("comunidad");
    await request(app)
      .get("/api/users")
      .query({ community: String(community._id) })
      .set(authHeader(adminToken))
      .expect(200);
  });
});

describe("GET /api/users/:id — perfil público", () => {
  it("200 incluso con `comunidad` deshabilitada (linkeado desde notifs)", async () => {
    const target = await createUser({ username: "perfil_target" });
    const { token } = await createAuthedUser();
    await disableSection("comunidad");
    const res = await request(app)
      .get(`/api/users/${target._id}`)
      .set(authHeader(token))
      .expect(200);
    expect(res.body.username).toBe("perfil_target");
  });
});
