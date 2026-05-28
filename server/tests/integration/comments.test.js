const request = require("supertest");
const app = require("../../app");
const Comment = require("../../models/Comment");
const { createUser, createAuthedUser, tokenFor } = require("../helpers/auth");
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

describe("POST /api/tables/:id/comments — privacy gate", () => {
  it("201 en mesa pública", async () => {
    const host = await createUser();
    const table = await createTable(host, { privacy: "public" });
    const res = await request(app)
      .post(`/api/tables/${table._id}/comments`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({ content: "primer comentario" });
    expect(res.status).toBe(201);
    expect(res.body.content).toBe("primer comentario");
  });

  it("403 en mesa privada", async () => {
    const host = await createUser();
    const table = await createTable(host, { privacy: "private" });
    const res = await request(app)
      .post(`/api/tables/${table._id}/comments`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({ content: "no debería entrar" });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/pública/i);
  });

  it("403 en mesa 'friends'", async () => {
    const host = await createUser();
    const table = await createTable(host, { privacy: "friends" });
    const res = await request(app)
      .post(`/api/tables/${table._id}/comments`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({ content: "no debería entrar" });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/tables/:id/comments — sigue libre", () => {
  it("200 en mesa privada (preserva historial)", async () => {
    const host = await createUser();
    const table = await createTable(host, { privacy: "private" });
    // Crear directo desde el modelo (sin pasar por POST que está gated).
    await Comment.create({
      table: table._id,
      author: host._id,
      content: "comentario viejo de cuando era pública",
    });
    const res = await request(app)
      .get(`/api/tables/${table._id}/comments`)
      .set("Authorization", `Bearer ${tokenFor(host)}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("200 en mesa 'friends' (preserva historial)", async () => {
    const host = await createUser();
    const table = await createTable(host, { privacy: "friends" });
    await Comment.create({
      table: table._id,
      author: host._id,
      content: "historial",
    });
    const res = await request(app)
      .get(`/api/tables/${table._id}/comments`)
      .set("Authorization", `Bearer ${tokenFor(host)}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});
