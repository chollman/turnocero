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
      category: "general",
      author: "Redacción",
    });
  });

  it("prefers the dek over the body as OG description", async () => {
    const author = await createUser({ displayName: "Redacción" });
    const noticia = await createNoticia(author, {
      title: "Con bajada",
      dek: "Esta es la bajada editorial.",
      body: "<p>Cuerpo en <strong>HTML</strong>.</p>",
      category: "evento",
    });

    const res = await request(app)
      .get(`/api/noticias/${noticia._id}/og`)
      .expect(200);

    expect(res.body.body).toBe("Esta es la bajada editorial.");
    expect(res.body.category).toBe("evento");
  });

  it("404s for a draft noticia", async () => {
    const author = await createUser();
    const noticia = await createNoticia(author, { status: "draft" });
    const res = await request(app)
      .get(`/api/noticias/${noticia._id}/og`)
      .expect(404);
    expect(res.body).toEqual({});
  });

  it("404s with an empty body for an unknown id", async () => {
    const res = await request(app)
      .get("/api/noticias/64b2f0000000000000000000/og")
      .expect(404);
    expect(res.body).toEqual({});
  });
});

describe("Noticias — editorial fields, drafts & sanitization", () => {
  it("creates a noticia with editorial fields and sanitizes the body", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .post("/api/noticias")
      .set(authHeader(token))
      .field("title", "Editorial")
      .field("dek", "Una bajada")
      .field("kicker", "Comunidad")
      .field("category", "comunidad")
      .field("tags", JSON.stringify(["torneo", "Wingspan", "torneo"]))
      .field(
        "body",
        '<p>Texto</p><script>alert(1)</script><iframe src="https://evil.com"></iframe>',
      )
      .field("quote", JSON.stringify({ text: "Una cita", author: "Vale" }))
      .field("featured", "true")
      .expect(201);

    expect(res.body.category).toBe("comunidad");
    expect(res.body.dek).toBe("Una bajada");
    expect(res.body.featured).toBe(true);
    expect(res.body.tags).toEqual(["torneo", "wingspan"]); // dedup + lowercase
    expect(res.body.quote.text).toBe("Una cita");
    expect(res.body.body).not.toMatch(/script/i);
    expect(res.body.body).not.toMatch(/evil\.com/i);
    expect(res.body.status).toBe("published");
    expect(res.body.publishedAt).toBeTruthy();
  });

  it("keeps a valid YouTube embed but strips foreign iframes", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .post("/api/noticias")
      .set(authHeader(token))
      .field("title", "Embed")
      .field(
        "body",
        '<p>a</p><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe><iframe src="https://other.com/x"></iframe>',
      )
      .expect(201);

    expect(res.body.body).toMatch(/youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
    expect(res.body.body).not.toMatch(/other\.com/);
    expect(res.body.body).toMatch(/sandbox=/);
  });

  it("creates a draft without emitting and hides it from non-admins", async () => {
    global.__ioStub.__reset();
    const { user: admin, token } = await createAuthedUser({ isAdmin: true });
    const create = await request(app)
      .post("/api/noticias")
      .set(authHeader(token))
      .field("title", "Borrador")
      .field("body", "wip")
      .field("status", "draft")
      .expect(201);

    expect(create.body.status).toBe("draft");
    expect(create.body.publishedAt).toBeFalsy();
    expect(
      global.__ioStub.emitted.filter((e) => e.event === "noticia:published"),
    ).toHaveLength(0);

    // No-admin gets a 404 on the draft detail.
    const { token: userToken } = await createAuthedUser();
    await request(app)
      .get(`/api/noticias/${create.body._id}`)
      .set(authHeader(userToken))
      .expect(404);

    // Admin can read it.
    await request(app)
      .get(`/api/noticias/${create.body._id}`)
      .set(authHeader(token))
      .expect(200);

    // Draft is excluded from the public list but visible to the admin.
    const pubList = await request(app)
      .get("/api/noticias")
      .set(authHeader(userToken))
      .expect(200);
    expect(
      pubList.body.noticias.find((n) => n._id === create.body._id),
    ).toBeUndefined();
    const adminList = await request(app)
      .get("/api/noticias")
      .set(authHeader(token))
      .expect(200);
    expect(
      adminList.body.noticias.find((n) => n._id === create.body._id),
    ).toBeTruthy();
    expect(admin).toBeTruthy();
  });

  it("emits noticia:published when a draft is published via PUT", async () => {
    const c = await Community.create({ name: "Pub", slug: "pub" });
    const member = await createUser({
      communityMemberships: [{ community: c._id, role: "member" }],
    });
    const { token } = await createAuthedUser({
      isAdmin: true,
      communityMemberships: [{ community: c._id, role: "member" }],
    });
    const create = await request(app)
      .post("/api/noticias")
      .set(authHeader(token))
      .field("title", "Borrador")
      .field("body", "wip")
      .field("status", "draft")
      .field("community", c._id.toString())
      .expect(201);

    global.__ioStub.__reset();
    const res = await request(app)
      .put(`/api/noticias/${create.body._id}`)
      .set(authHeader(token))
      .field("status", "published")
      .expect(200);

    expect(res.body.status).toBe("published");
    expect(res.body.publishedAt).toBeTruthy();
    const events = global.__ioStub.emitted.filter(
      (e) => e.event === "noticia:published",
    );
    expect(events).toHaveLength(1);
    expect(events[0].room).toContain(`user:${member._id}`);
  });

  it("PUT only updates fields present in the body (partial update)", async () => {
    const { user: admin, token } = await createAuthedUser({ isAdmin: true });
    const noticia = await createNoticia(admin, {
      title: "Original",
      dek: "Bajada original",
      category: "resena",
    });

    const res = await request(app)
      .put(`/api/noticias/${noticia._id}`)
      .set(authHeader(token))
      .field("title", "Editado")
      .expect(200);

    expect(res.body.title).toBe("Editado");
    expect(res.body.dek).toBe("Bajada original"); // no se tocó
    expect(res.body.category).toBe("resena"); // no se tocó
  });

  it("filters the list by category and search", async () => {
    const author = await createUser();
    await createNoticia(author, {
      title: "Reseña Sky Team",
      category: "resena",
    });
    await createNoticia(author, {
      title: "Evento Commander",
      category: "evento",
    });

    const byCat = await request(app)
      .get("/api/noticias?category=resena")
      .expect(200);
    expect(byCat.body.noticias).toHaveLength(1);
    expect(byCat.body.noticias[0].category).toBe("resena");

    const bySearch = await request(app)
      .get("/api/noticias?search=commander")
      .expect(200);
    expect(bySearch.body.noticias).toHaveLength(1);
    expect(bySearch.body.noticias[0].title).toMatch(/Commander/);
  });

  it("rejects inline-image upload for non-admins", async () => {
    const { token } = await createAuthedUser();
    await request(app)
      .post("/api/noticias/inline-image")
      .set(authHeader(token))
      .expect(403);
  });
});
