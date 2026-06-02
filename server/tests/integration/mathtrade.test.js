// Evita llamadas de red a BGG: snapshots con nombre sintético por id.
vi.mock("../../services/bgg/bggResolve", () => ({
  resolveGamesBatch: async (ids) =>
    new Map(
      (ids || []).map((id) => [
        Number(id),
        { id: Number(id), name: `Game ${id}`, thumbnail: "" },
      ]),
    ),
  resolveGame: async (id) => ({
    id: Number(id),
    name: `Game ${id}`,
    thumbnail: "",
  }),
}));

const request = require("supertest");
const app = require("../../app");
const MathTrade = require("../../models/MathTrade");
const MathTradeItem = require("../../models/MathTradeItem");
const Notification = require("../../models/Notification");
const { createAuthedUser } = require("../helpers/auth");
const { loadSiteConfig, updateSiteConfig } = require("../../utils/siteConfig");
const SiteConfig = require("../../models/SiteConfig");

beforeEach(async () => {
  const all = {};
  for (const key of SiteConfig.SECTION_KEYS) all[key] = { enabled: true };
  await loadSiteConfig();
  await updateSiteConfig(all, null, null);
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function createTrade(adminToken, overrides = {}) {
  const res = await request(app)
    .post("/api/mathtrade")
    .set(auth(adminToken))
    .field("title", overrides.title || "Trade test")
    .field("mode", overrides.mode || "max")
    .field("maxChainLength", String(overrides.maxChainLength || 4));
  return res.body;
}

async function setStatus(adminToken, id, status) {
  return request(app)
    .patch(`/api/mathtrade/${id}/status`)
    .set(auth(adminToken))
    .send({ status });
}

// Carga un 3-ciclo: u1(juego1→quiere2), u2(2→3), u3(3→1).
async function seedThreeCycleItems(id, users) {
  await request(app)
    .post(`/api/mathtrade/${id}/items`)
    .set(auth(users[0].token))
    .send({ bggGameId: 1, wants: [{ bggGameId: 2 }] });
  await request(app)
    .post(`/api/mathtrade/${id}/items`)
    .set(auth(users[1].token))
    .send({ bggGameId: 2, wants: [{ bggGameId: 3 }] });
  await request(app)
    .post(`/api/mathtrade/${id}/items`)
    .set(auth(users[2].token))
    .send({ bggGameId: 3, wants: [{ bggGameId: 1 }] });
}

describe("POST /api/mathtrade", () => {
  it("non-admin gets 403", async () => {
    const { token } = await createAuthedUser({ isAdmin: false });
    const res = await request(app)
      .post("/api/mathtrade")
      .set(auth(token))
      .field("title", "x");
    expect(res.status).toBe(403);
  });

  it("admin crea un math trade en draft", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .post("/api/mathtrade")
      .set(auth(token))
      .field("title", "Mi trade")
      .field("mode", "bounded")
      .field("maxChainLength", "3");
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("draft");
    expect(res.body.matching.mode).toBe("bounded");
    expect(res.body.matching.maxChainLength).toBe(3);
  });

  it("rechaza sin título", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .post("/api/mathtrade")
      .set(auth(token))
      .field("title", "");
    expect(res.status).toBe(400);
  });
});

describe("visibilidad de drafts", () => {
  it("draft oculto a no-admin en GET /:id (404) y en la lista", async () => {
    const { token: adminToken } = await createAuthedUser({ isAdmin: true });
    const { token: userToken } = await createAuthedUser({ isAdmin: false });
    const mt = await createTrade(adminToken);

    const detail = await request(app)
      .get(`/api/mathtrade/${mt._id}`)
      .set(auth(userToken));
    expect(detail.status).toBe(404);

    const list = await request(app).get("/api/mathtrade").set(auth(userToken));
    expect(list.body.mathtrades.find((t) => t._id === mt._id)).toBeUndefined();
  });
});

describe("carga de ítems", () => {
  it("solo permite cargar en estado 'open'", async () => {
    const { token: adminToken } = await createAuthedUser({ isAdmin: true });
    const { token: userToken } = await createAuthedUser();
    const mt = await createTrade(adminToken);

    const blocked = await request(app)
      .post(`/api/mathtrade/${mt._id}/items`)
      .set(auth(userToken))
      .send({ bggGameId: 1, wants: [{ bggGameId: 2 }] });
    expect(blocked.status).toBe(400);

    await setStatus(adminToken, mt._id, "open");
    const ok = await request(app)
      .post(`/api/mathtrade/${mt._id}/items`)
      .set(auth(userToken))
      .send({ bggGameId: 1, wants: [{ bggGameId: 2 }] });
    expect(ok.status).toBe(201);
    expect(ok.body.bggGameId).toBe(1);
    expect(ok.body.wants[0].bggGameId).toBe(2);
  });

  it("rechaza editar/borrar el ítem de otro usuario", async () => {
    const { token: adminToken } = await createAuthedUser({ isAdmin: true });
    const u1 = await createAuthedUser();
    const u2 = await createAuthedUser();
    const mt = await createTrade(adminToken);
    await setStatus(adminToken, mt._id, "open");

    const created = await request(app)
      .post(`/api/mathtrade/${mt._id}/items`)
      .set(auth(u1.token))
      .send({ bggGameId: 1, wants: [{ bggGameId: 2 }] });

    const editOther = await request(app)
      .put(`/api/mathtrade/${mt._id}/items/${created.body._id}`)
      .set(auth(u2.token))
      .send({ bggGameId: 9, wants: [] });
    expect(editOther.status).toBe(403);

    const delOther = await request(app)
      .delete(`/api/mathtrade/${mt._id}/items/${created.body._id}`)
      .set(auth(u2.token));
    expect(delOther.status).toBe(403);
  });
});

describe("ciclo de vida completo + matching", () => {
  it("create → open → items → lock → results: matchea y notifica", async () => {
    const { token: adminToken } = await createAuthedUser({ isAdmin: true });
    const users = await Promise.all([
      createAuthedUser(),
      createAuthedUser(),
      createAuthedUser(),
    ]);
    const mt = await createTrade(adminToken);
    await setStatus(adminToken, mt._id, "open");
    await seedThreeCycleItems(mt._id, users);
    await setStatus(adminToken, mt._id, "locked");

    // Preview no persiste.
    const preview = await request(app)
      .post(`/api/mathtrade/${mt._id}/run-matching/preview`)
      .set(auth(adminToken))
      .send({ mode: "max" });
    expect(preview.status).toBe(200);
    expect(preview.body.summary.itemsTraded).toBe(3);
    expect(preview.body.cycles).toHaveLength(1);
    const stillUnrun = await MathTrade.findById(mt._id).lean();
    expect(stillUnrun.lastRunAt).toBeNull();

    // Publicar resultados (auto-corre el matching).
    const published = await setStatus(adminToken, mt._id, "results");
    expect(published.status).toBe(200);
    expect(published.body.status).toBe("results");
    expect(published.body.summary.itemsTraded).toBe(3);
    expect(published.body.published).toBe(true);

    // GET results visible públicamente.
    const results = await request(app).get(`/api/mathtrade/${mt._id}/results`);
    expect(results.status).toBe(200);
    expect(results.body.cycles).toHaveLength(1);
    expect(results.body.cycles[0].length).toBe(3);

    // Notificación mathtrade_results para los 3 dueños.
    const notifs = await Notification.find({
      type: "mathtrade_results",
    }).lean();
    expect(notifs).toHaveLength(3);
    expect(notifs.every((n) => n.mathtradeId === String(mt._id))).toBe(true);
  });

  it("modo bounded K=2 no arma el 3-ciclo", async () => {
    const { token: adminToken } = await createAuthedUser({ isAdmin: true });
    const users = await Promise.all([
      createAuthedUser(),
      createAuthedUser(),
      createAuthedUser(),
    ]);
    const mt = await createTrade(adminToken, {
      mode: "bounded",
      maxChainLength: 2,
    });
    await setStatus(adminToken, mt._id, "open");
    await seedThreeCycleItems(mt._id, users);
    await setStatus(adminToken, mt._id, "locked");

    const run = await request(app)
      .post(`/api/mathtrade/${mt._id}/run-matching`)
      .set(auth(adminToken))
      .send({ mode: "bounded", maxChainLength: 2 });
    expect(run.status).toBe(200);
    expect(run.body.summary.itemsTraded).toBe(0);

    const items = await MathTradeItem.find({ mathtrade: mt._id }).lean();
    expect(items.every((it) => it.traded === false)).toBe(true);
  });

  it("results → locked limpia los resultados", async () => {
    const { token: adminToken } = await createAuthedUser({ isAdmin: true });
    const users = await Promise.all([
      createAuthedUser(),
      createAuthedUser(),
      createAuthedUser(),
    ]);
    const mt = await createTrade(adminToken);
    await setStatus(adminToken, mt._id, "open");
    await seedThreeCycleItems(mt._id, users);
    await setStatus(adminToken, mt._id, "locked");
    await setStatus(adminToken, mt._id, "results");

    const back = await setStatus(adminToken, mt._id, "locked");
    expect(back.status).toBe(200);
    const fresh = await MathTrade.findById(mt._id).lean();
    expect(fresh.summary.itemsTraded).toBe(0);
    expect(fresh.published).toBe(false);
    const items = await MathTradeItem.find({ mathtrade: mt._id }).lean();
    expect(items.every((it) => it.traded === false)).toBe(true);
  });

  it("transición inválida devuelve 400", async () => {
    const { token: adminToken } = await createAuthedUser({ isAdmin: true });
    const mt = await createTrade(adminToken);
    const res = await setStatus(adminToken, mt._id, "results"); // draft → results
    expect(res.status).toBe(400);
  });
});
