const request = require("supertest");
const app = require("../../app");
const { createAuthedUser, authHeader } = require("../helpers/auth");

describe("User.language preference", () => {
  it("nuevos usuarios arrancan con language='es'", async () => {
    const { user } = await createAuthedUser();
    expect(user.language).toBe("es");
  });

  it("PUT /api/auth/profile persiste language='en'", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .put("/api/auth/profile")
      .set(authHeader(token))
      .send({ language: "en" });
    expect(res.status).toBe(200);
    expect(res.body.language).toBe("en");
  });

  it("ignora un language inválido", async () => {
    const { token } = await createAuthedUser({ language: "es" });
    const res = await request(app)
      .put("/api/auth/profile")
      .set(authHeader(token))
      .send({ language: "fr" });
    expect(res.status).toBe(200);
    expect(res.body.language).toBe("es");
  });
});
