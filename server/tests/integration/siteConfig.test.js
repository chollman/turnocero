const request = require("supertest");
const app = require("../../app");
const { createAuthedUser } = require("../helpers/auth");
const { loadSiteConfig } = require("../../utils/siteConfig");

beforeEach(async () => {
  await loadSiteConfig();
});

describe("GET /api/site-config", () => {
  it("is public and returns the section flags", async () => {
    const res = await request(app).get("/api/site-config");
    expect(res.status).toBe(200);
    expect(res.body.sections).toBeDefined();
    expect(res.body.sections.compartidas.enabled).toBe(true);
    expect(res.body.sections.mesas.enabled).toBe(false); // default OFF
  });
});

describe("PATCH /api/site-config (admin only)", () => {
  it("non-admin gets 403", async () => {
    const { token } = await createAuthedUser({ isAdmin: false });
    const res = await request(app)
      .patch("/api/site-config")
      .set("Authorization", `Bearer ${token}`)
      .send({ sections: { mesas: { enabled: true } } });
    expect(res.status).toBe(403);
  });

  it("admin can flip a section", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .patch("/api/site-config")
      .set("Authorization", `Bearer ${token}`)
      .send({ sections: { mesas: { enabled: true } } });
    expect(res.status).toBe(200);
    expect(res.body.sections.mesas.enabled).toBe(true);
  });

  it("400s on missing body", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .patch("/api/site-config")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("emits site-config:updated on the io stub", async () => {
    global.__ioStub.__reset();
    const { token } = await createAuthedUser({ isAdmin: true });
    await request(app)
      .patch("/api/site-config")
      .set("Authorization", `Bearer ${token}`)
      .send({ sections: { eventos: { enabled: false } } });
    const emitted = global.__ioStub.emitted.find(
      (e) => e.event === "site-config:updated",
    );
    expect(emitted).toBeDefined();
  });
});
