const request = require("supertest");
const app = require("../../app");
const Compartida = require("../../models/Compartida");
const { createUser } = require("../helpers/auth");
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

describe("GET /api/compartidas/stats", () => {
  it("anon: total = públicas visibles; week = públicas de los últimos 7 días", async () => {
    const author = await createUser();
    await createCompartida(author, { body: "Pub 1", privacy: "public" });
    await createCompartida(author, { body: "Pub 2", privacy: "public" });
    // Privada → no cuenta para un anónimo.
    await createCompartida(author, { body: "Secreta", privacy: "private" });
    // Pública pero vieja (hace 10 días) → cuenta en total, NO en week. Forzamos
    // createdAt por el driver raw (mongoose lo trata como inmutable).
    const old = await createCompartida(author, {
      body: "Vieja",
      privacy: "public",
    });
    await Compartida.collection.updateOne(
      { _id: old._id },
      { $set: { createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) } },
    );

    const res = await request(app).get("/api/compartidas/stats");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3); // 3 públicas (la privada se excluye)
    expect(res.body.week).toBe(2); // 2 públicas recientes (la vieja se excluye)
  });

  it("/stats no se interpreta como /:id (no tira 400 de ObjectId)", async () => {
    const res = await request(app).get("/api/compartidas/stats");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("week");
  });
});
