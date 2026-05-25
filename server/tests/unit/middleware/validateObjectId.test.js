const express = require("express");
const request = require("supertest");
const validateObjectId = require("../../../middleware/validateObjectId");

function makeApp({ paramName = "id" } = {}) {
  const app = express();
  app.get(`/foo/:${paramName}`, validateObjectId(paramName), (req, res) => {
    res.json({ ok: true, id: req.params[paramName] });
  });
  return app;
}

describe("validateObjectId middleware", () => {
  it("200 para ObjectId hex válido (24 chars)", async () => {
    const app = makeApp();
    const res = await request(app).get("/foo/507f1f77bcf86cd799439011");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("400 para string que no es ObjectId válido", async () => {
    const app = makeApp();
    const res = await request(app).get("/foo/not-an-id");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/inválido/i);
  });

  it("400 para string vacío o demasiado corto", async () => {
    const app = makeApp();
    const res = await request(app).get("/foo/abc");
    expect(res.status).toBe(400);
  });

  it("respeta el paramName custom", async () => {
    const app = makeApp({ paramName: "userId" });
    const valid = await request(app).get("/foo/507f1f77bcf86cd799439011");
    expect(valid.status).toBe(200);
    expect(valid.body.id).toBe("507f1f77bcf86cd799439011");
    const invalid = await request(app).get("/foo/bad");
    expect(invalid.status).toBe(400);
  });
});
