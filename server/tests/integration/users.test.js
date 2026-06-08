const request = require("supertest");
const app = require("../../app");
const Community = require("../../models/Community");
const { createUser, createAuthedUser, authHeader } = require("../helpers/auth");
const { createTable } = require("../helpers/factories");
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

  it("expone bggConnected/bggInvalid sin filtrar el password cifrado", async () => {
    await createUser({
      username: "connected_player",
      bggUsername: "ConnPlayer",
      bggCredentials: {
        encryptedPassword: "enc:supersecret",
        connectedAt: new Date(),
      },
    });
    await createUser({ username: "username_only", bggUsername: "JustName" });
    const { token } = await createAuthedUser();

    const res = await request(app)
      .get("/api/users")
      .set(authHeader(token))
      .expect(200);

    const connected = res.body.find((u) => u.username === "connected_player");
    const onlyName = res.body.find((u) => u.username === "username_only");

    // El que tiene password guardado → conectado; el que solo seteó el
    // username → NO conectado (puede ver su perfil, no cargar partidas).
    expect(connected.bggConnected).toBe(true);
    expect(connected.bggInvalid).toBe(false);
    expect(onlyName.bggConnected).toBe(false);

    // Nunca se filtra el subdoc de credenciales ni el password cifrado.
    expect(connected.bggCredentials).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("supersecret");
  });

  it("bggInvalid=true cuando las credenciales caducaron", async () => {
    await createUser({
      username: "invalid_creds",
      bggUsername: "InvName",
      bggCredentials: { encryptedPassword: "enc:x", invalid: true },
    });
    const { token } = await createAuthedUser();

    const res = await request(app)
      .get("/api/users")
      .set(authHeader(token))
      .expect(200);

    const u = res.body.find((x) => x.username === "invalid_creds");
    expect(u.bggConnected).toBe(true);
    expect(u.bggInvalid).toBe(true);
  });
});

describe("GET /api/users — conteos de actividad scopeados por comunidad", () => {
  it("sin ?community los conteos se acotan a lo que el viewer ve", async () => {
    const beta = await Community.create({ name: "BetaView", slug: "betaview" });
    const target = await createUser({ username: "target_view" });
    await createTable(target); // base
    await createTable(target, { community: beta._id }); // beta

    // Viewer base-only → conteos acotados a la base.
    const { token } = await createAuthedUser();
    const res = await request(app)
      .get("/api/users")
      .set(authHeader(token))
      .expect(200);
    const row = res.body.find((u) => u.username === "target_view");
    expect(row).toBeTruthy();
    expect(row.tablesHosted).toBe(1); // solo la mesa de la base
  });

  it("con ?community los conteos son de esa comunidad, no globales", async () => {
    const beta = await Community.create({
      name: "BetaCount",
      slug: "betacount",
      joinPolicy: "open",
    });
    const target = await createUser({
      username: "jugador_activo",
      communityMemberships: [{ community: beta._id, role: "member" }],
    });
    await createTable(target); // base
    await createTable(target, { community: beta._id }); // beta

    // Admin bypasea gates; pide la lista de miembros de beta.
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .get("/api/users")
      .query({ community: String(beta._id) })
      .set(authHeader(token))
      .expect(200);
    const row = res.body.find((u) => u.username === "jugador_activo");
    expect(row).toBeTruthy();
    expect(row.tablesHosted).toBe(1); // solo la mesa de beta
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
