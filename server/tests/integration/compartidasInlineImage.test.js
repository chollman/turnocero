vi.mock("../../config/cloudinary", () => require("../mocks/cloudinary"));

const request = require("supertest");
const app = require("../../app");
const { createAuthedUser } = require("../helpers/auth");
const { loadSiteConfig, updateSiteConfig } = require("../../utils/siteConfig");
const SiteConfig = require("../../models/SiteConfig");

async function enableAllSections() {
  const all = {};
  for (const key of SiteConfig.SECTION_KEYS) all[key] = { enabled: true };
  await loadSiteConfig();
  await updateSiteConfig(all, null, null);
}

beforeEach(enableAllSections);

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("POST /api/compartidas/inline-image", () => {
  it("sube la imagen y devuelve la URL", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/compartidas/inline-image")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", png, "foto.png");
    expect(res.status).toBe(201);
    expect(typeof res.body.url).toBe("string");
    expect(res.body.url).toMatch(/^https?:\/\//);
  });

  it("400 si no se manda imagen", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/compartidas/inline-image")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("401 sin autenticación", async () => {
    const res = await request(app)
      .post("/api/compartidas/inline-image")
      .attach("image", png, "foto.png");
    expect(res.status).toBe(401);
  });
});
