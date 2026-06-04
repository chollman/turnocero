const request = require("supertest");
const app = require("../../app");
const Rating = require("../../models/Rating");
const { createUser, tokenFor } = require("../helpers/auth");
const { createTable } = require("../helpers/factories");
const { loadSiteConfig, updateSiteConfig } = require("../../utils/siteConfig");
const SiteConfig = require("../../models/SiteConfig");

async function enableAllSections() {
  const all = {};
  for (const key of SiteConfig.SECTION_KEYS) all[key] = { enabled: true };
  await loadSiteConfig();
  await updateSiteConfig(all, null, null);
}

beforeEach(enableAllSections);

// Las valoraciones solo se permiten DESPUÉS de la fecha de la mesa.
const pastDate = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

describe("POST /api/tables/:id/ratings — privacy gate", () => {
  it("201 en mesa pública pasada (host participa)", async () => {
    const host = await createUser();
    const table = await createTable(host, {
      privacy: "public",
      date: pastDate(),
    });
    const res = await request(app)
      .post(`/api/tables/${table._id}/ratings`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({ score: 5, comment: "joya" });
    expect(res.status).toBe(201);
    expect(res.body.rating.score).toBe(5);
  });

  it("403 en mesa privada pasada", async () => {
    const host = await createUser();
    const table = await createTable(host, {
      privacy: "private",
      date: pastDate(),
    });
    const res = await request(app)
      .post(`/api/tables/${table._id}/ratings`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({ score: 5 });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/pública/i);
  });

  it("403 en mesa 'friends' pasada", async () => {
    const host = await createUser();
    const table = await createTable(host, {
      privacy: "friends",
      date: pastDate(),
    });
    const res = await request(app)
      .post(`/api/tables/${table._id}/ratings`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({ score: 5 });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/tables/:id/ratings — sigue libre", () => {
  it("200 en mesa privada (preserva historial)", async () => {
    const host = await createUser();
    const table = await createTable(host, {
      privacy: "private",
      date: pastDate(),
    });
    await Rating.create({
      table: table._id,
      rater: host._id,
      score: 4,
      comment: "viejo",
    });
    const res = await request(app)
      .get(`/api/tables/${table._id}/ratings`)
      .set("Authorization", `Bearer ${tokenFor(host)}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.avg).toBe(4);
  });
});
