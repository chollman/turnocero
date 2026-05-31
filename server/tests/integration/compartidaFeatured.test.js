const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../../app");
const { createCompartida } = require("../helpers/factories");
const { createAuthedUser } = require("../helpers/auth");

// Regression: la "Compartida del día" (featured) es la más likeada de las
// últimas 24h. El bug original ordenaba con `sort({ "likes.length": -1 })`
// (no-op en Mongo: no es un campo escalar) y luego `.limit(10)` truncaba un
// set sin ordenar — si había >10 posts recientes, el realmente más likeado
// podía quedar afuera. Ahora se usa una aggregation con $size + $sort + $limit.

const fakeLikes = (n) =>
  Array.from({ length: n }, () => new mongoose.Types.ObjectId());

describe("GET /api/compartidas featured (compartida del día)", () => {
  it("selects the most-liked recent post even with >10 recent posts", async () => {
    const { user, token } = await createAuthedUser();

    // 10 posts con pocos likes, creados primero (orden natural).
    for (let i = 0; i < 10; i++) {
      await createCompartida({
        author: user,
        text: `relleno ${i}`,
        privacy: "public",
        likes: fakeLikes(1),
      });
    }
    // El más likeado se crea ÚLTIMO → con el bug quedaba fuera del limit(10).
    const winner = await createCompartida({
      author: user,
      text: "el ganador",
      privacy: "public",
      likes: fakeLikes(9),
    });

    const res = await request(app)
      .get("/api/compartidas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.featured).toBeTruthy();
    expect(res.body.featured._id.toString()).toBe(winner._id.toString());
  });
});
