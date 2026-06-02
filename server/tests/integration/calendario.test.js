const request = require("supertest");
const app = require("../../app");
const { createUser, createAuthedUser, authHeader } = require("../helpers/auth");
const {
  createTable,
  createEvento,
  createTorneo,
} = require("../helpers/factories");
const { loadSiteConfig, updateSiteConfig } = require("../../utils/siteConfig");

const daysFromNow = (n) => new Date(Date.now() + n * 86400000);

const RANGE = {
  from: daysFromNow(-1).toISOString(),
  to: daysFromNow(30).toISOString(),
};

async function enableSections(keys) {
  const patch = {};
  for (const k of keys) patch[k] = { enabled: true };
  await updateSiteConfig(patch, null, null);
}

describe("GET /api/calendario", () => {
  // El cache de SiteConfig es module-level; lo reseteamos a defaults en cada
  // test (la DB se limpia en afterEach, así loadSiteConfig recrea el singleton
  // con los defaults: mesas/torneos OFF, eventos/calendario ON).
  beforeEach(async () => {
    await loadSiteConfig();
  });

  it("agrega mesas, eventos y torneos en rango (admin ve todas las secciones)", async () => {
    const { user: admin, token } = await createAuthedUser({ isAdmin: true });
    const host = await createUser();
    await createTable(host, { date: daysFromNow(3), privacy: "public" });
    await createEvento(host, { eventDate: daysFromNow(5), status: "open" });
    await createTorneo(admin, {
      status: "registration",
      fecha: daysFromNow(7),
    });

    const res = await request(app)
      .get("/api/calendario")
      .query(RANGE)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
    const tipos = res.body.items.map((i) => i.tipo).sort();
    expect(tipos).toEqual(["evento", "mesa", "torneo"]);
    // Normalización: cada item linkea a su detalle.
    const torneo = res.body.items.find((i) => i.tipo === "torneo");
    expect(torneo.url).toMatch(/^\/torneos\//);
    expect(torneo.title).toBeTruthy();
  });

  it("ordena los items por fecha ascendente", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const host = await createUser();
    await createEvento(host, { eventDate: daysFromNow(10), status: "open" });
    await createEvento(host, { eventDate: daysFromNow(2), status: "open" });

    const res = await request(app)
      .get("/api/calendario")
      .query(RANGE)
      .set(authHeader(token));

    const dates = res.body.items.map((i) => new Date(i.date).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });

  it("excluye torneos sin fecha", async () => {
    const { user: admin, token } = await createAuthedUser({ isAdmin: true });
    await createTorneo(admin, { status: "registration" }); // sin fecha

    const res = await request(app)
      .get("/api/calendario")
      .query(RANGE)
      .set(authHeader(token));

    expect(res.body.items.find((i) => i.tipo === "torneo")).toBeUndefined();
  });

  it("excluye items fuera del rango de fechas", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const host = await createUser();
    await createEvento(host, { eventDate: daysFromNow(100), status: "open" });

    const res = await request(app)
      .get("/api/calendario")
      .query(RANGE)
      .set(authHeader(token));

    expect(res.body.items).toHaveLength(0);
  });

  it("omite tipos cuya sección está deshabilitada (usuario regular)", async () => {
    // Para un usuario regular, mesas y torneos están OFF por default — solo
    // eventos debería aparecer.
    const { token } = await createAuthedUser();
    const host = await createUser();
    await createTable(host, { date: daysFromNow(3), privacy: "public" });
    await createEvento(host, { eventDate: daysFromNow(4), status: "open" });
    await createTorneo(host, {
      status: "registration",
      fecha: daysFromNow(5),
    });

    const res = await request(app)
      .get("/api/calendario")
      .query(RANGE)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    const tipos = res.body.items.map((i) => i.tipo);
    expect(tipos).toEqual(["evento"]);
  });

  it("invitado: solo ve mesas públicas (respeta privacidad)", async () => {
    await enableSections(["mesas"]);
    const a = await createUser();
    const b = await createUser();
    await createTable(a, { date: daysFromNow(2), privacy: "public" });
    await createTable(b, { date: daysFromNow(3), privacy: "friends" });

    const res = await request(app)
      .get("/api/calendario")
      .query({ ...RANGE, tipos: "mesa" }); // sin auth

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].tipo).toBe("mesa");
  });

  it("scope=mias requiere autenticación", async () => {
    const res = await request(app)
      .get("/api/calendario")
      .query({ ...RANGE, scope: "mias" });

    expect(res.status).toBe(401);
  });

  it("scope=mias devuelve solo las entidades del usuario", async () => {
    await enableSections(["mesas"]);
    const { user: a, token } = await createAuthedUser();
    const b = await createUser();
    const mine = await createTable(a, { date: daysFromNow(2) });
    await createTable(b, { date: daysFromNow(3) }); // de otro usuario

    const res = await request(app)
      .get("/api/calendario")
      .query({ ...RANGE, scope: "mias", tipos: "mesa" })
      .set(authHeader(token));

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(String(mine._id));
  });

  it("oculta eventos draft a no-admin pero los muestra a admin", async () => {
    const host = await createUser();
    await createEvento(host, { eventDate: daysFromNow(4), status: "draft" });

    const { token: regularToken } = await createAuthedUser();
    const regularRes = await request(app)
      .get("/api/calendario")
      .query(RANGE)
      .set(authHeader(regularToken));
    expect(regularRes.body.items).toHaveLength(0);

    const { token: adminToken } = await createAuthedUser({ isAdmin: true });
    const adminRes = await request(app)
      .get("/api/calendario")
      .query(RANGE)
      .set(authHeader(adminToken));
    expect(adminRes.body.items.some((i) => i.tipo === "evento")).toBe(true);
  });

  it("devuelve 400 si from > to", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .get("/api/calendario")
      .query({
        from: daysFromNow(10).toISOString(),
        to: daysFromNow(1).toISOString(),
      })
      .set(authHeader(token));
    expect(res.status).toBe(400);
  });
});
