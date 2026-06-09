const request = require("supertest");
const app = require("../../app");
const Community = require("../../models/Community");
const { createUser, createAuthedUser, authHeader } = require("../helpers/auth");
const { createNoticia } = require("../helpers/factories");

// El toast `noticia:published` se emite DIRIGIDO a los miembros de la comunidad
// de la noticia (antes era un `io.emit` global que rociaba a todos los usuarios,
// incluso a los que no integran la comunidad). Ver routes/noticias.js.
describe("POST /api/noticias — noticia:published emit targeting", () => {
  beforeEach(() => global.__ioStub.__reset());

  const eventsOf = (name) =>
    global.__ioStub.emitted.filter((e) => e.event === name);

  it("emits noticia:published only to the community's members, excluding the author", async () => {
    const c = await Community.create({ name: "C", slug: "c" });
    const other = await Community.create({ name: "O", slug: "o" });
    const m1 = await createUser({
      communityMemberships: [{ community: c._id, role: "member" }],
    });
    const m2 = await createUser({
      communityMemberships: [{ community: c._id, role: "subadmin" }],
    });
    const nonmember = await createUser({
      communityMemberships: [{ community: other._id, role: "member" }],
    });
    // Admin autor que TAMBIÉN es miembro de la comunidad → debe excluirse a sí mismo.
    const { user: admin, token } = await createAuthedUser({
      isAdmin: true,
      communityMemberships: [{ community: c._id, role: "member" }],
    });

    await request(app)
      .post("/api/noticias")
      .set(authHeader(token))
      .field("title", "Novedad")
      .field("body", "Cuerpo de la noticia")
      .field("community", c._id.toString())
      .expect(201);

    const events = eventsOf("noticia:published");
    expect(events).toHaveLength(1);
    const ev = events[0];

    // Dirigido a un array de rooms de usuario, nunca broadcast global (room null).
    expect(Array.isArray(ev.room)).toBe(true);
    expect(ev.room).toEqual(
      expect.arrayContaining([`user:${m1._id}`, `user:${m2._id}`]),
    );
    // No al no-miembro ni al autor.
    expect(ev.room).not.toContain(`user:${nonmember._id}`);
    expect(ev.room).not.toContain(`user:${admin._id}`);
    // Lleva la comunidad para el scoping por subdominio del cliente.
    expect(ev.payload.community).toBe(c._id.toString());
  });

  it("does not emit at all when the community has no other members", async () => {
    const c = await Community.create({ name: "Solo", slug: "solo" });
    // El único miembro es el admin autor → tras excluirlo, no quedan destinatarios.
    const { token } = await createAuthedUser({
      isAdmin: true,
      communityMemberships: [{ community: c._id, role: "member" }],
    });

    await request(app)
      .post("/api/noticias")
      .set(authHeader(token))
      .field("title", "Sola")
      .field("body", "x")
      .field("community", c._id.toString())
      .expect(201);

    expect(eventsOf("noticia:published")).toHaveLength(0);
  });
});

describe("GET /api/noticias/:id/og — OG data for crawlers", () => {
  it("returns the OG fields for an existing noticia (no auth)", async () => {
    const author = await createUser({ displayName: "Redacción" });
    const noticia = await createNoticia(author, {
      title: "Gran novedad",
      body: "Cuerpo de la noticia con texto plano.",
      image: { url: "https://cdn/x.jpg", publicId: "x" },
    });

    const res = await request(app)
      .get(`/api/noticias/${noticia._id}/og`)
      .expect(200);

    expect(res.body).toEqual({
      title: "Gran novedad",
      body: "Cuerpo de la noticia con texto plano.",
      image: "https://cdn/x.jpg",
      author: "Redacción",
    });
  });

  it("404s with an empty body for an unknown id", async () => {
    const res = await request(app)
      .get("/api/noticias/64b2f0000000000000000000/og")
      .expect(404);
    expect(res.body).toEqual({});
  });
});
