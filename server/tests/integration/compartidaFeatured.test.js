const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../../app");
const CompartidaComment = require("../../models/CompartidaComment");
const { createCompartida } = require("../helpers/factories");
const { createAuthedUser, createUser } = require("../helpers/auth");

// El featured ("destacado") es el post con más engagement (likes + comentarios)
// de las últimas 24h. El bug original ordenaba con `sort({ "likes.length": -1 })`
// (no-op en Mongo: no es un campo escalar) y luego `.limit(10)` truncaba un
// set sin ordenar. Ahora se usa una aggregation con $lookup (comentarios) +
// $size + $sort + $limit.

const fakeLikes = (n) =>
  Array.from({ length: n }, () => new mongoose.Types.ObjectId());

const addComments = async (compartida, author, n) =>
  Promise.all(
    Array.from({ length: n }, (_, i) =>
      CompartidaComment.create({
        compartida: compartida._id,
        author: author._id,
        content: `c${i}`,
      }),
    ),
  );

describe("GET /api/compartidas featured (compartida del día)", () => {
  it("selects the most-liked recent post even with >10 recent posts", async () => {
    const { user, token } = await createAuthedUser();

    // 10 posts con pocos likes, creados primero (orden natural).
    for (let i = 0; i < 10; i++) {
      await createCompartida(user, {
        body: `relleno ${i}`,
        privacy: "public",
        likes: fakeLikes(1),
      });
    }
    // El más likeado se crea ÚLTIMO → con el bug quedaba fuera del limit(10).
    const winner = await createCompartida(user, {
      body: "el ganador",
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

  it("cuenta likes + comentarios: gana el de más engagement total", async () => {
    const { user, token } = await createAuthedUser();
    const commenter = await createUser();

    // A: 3 likes, 0 comentarios → engagement 3.
    await createCompartida(user, {
      body: "muchos likes",
      privacy: "public",
      likes: fakeLikes(3),
    });
    // B: 1 like, 4 comentarios → engagement 5 (gana aunque tenga menos likes).
    const winner = await createCompartida(user, {
      body: "muchos comentarios",
      privacy: "public",
      likes: fakeLikes(1),
    });
    await addComments(winner, commenter, 4);

    const res = await request(app)
      .get("/api/compartidas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.featured._id.toString()).toBe(winner._id.toString());
  });

  it("no destaca nada si ningún post reciente tiene engagement", async () => {
    const { user, token } = await createAuthedUser();
    await createCompartida(user, {
      body: "sin likes ni comentarios",
      privacy: "public",
      likes: [],
    });

    const res = await request(app)
      .get("/api/compartidas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.featured).toBeNull();
    // El post sigue apareciendo en la lista normal.
    expect(res.body.compartidas.map((c) => c.body)).toContain(
      "sin likes ni comentarios",
    );
  });
});
