const request = require("supertest");
const app = require("../../app");
const Comment = require("../../models/Comment");
const Notification = require("../../models/Notification");
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

describe("Respuestas a comentarios (hilo de 1 nivel)", () => {
  it("crea una respuesta y la anida bajo el comentario padre en el GET", async () => {
    const host = await createUser();
    const replier = await createAuthedUser();
    const table = await createTable(host, { privacy: "public" });

    const root = await Comment.create({
      table: table._id,
      author: host._id,
      content: "comentario raíz",
    });

    const replyRes = await request(app)
      .post(`/api/tables/${table._id}/comments`)
      .set("Authorization", `Bearer ${replier.token}`)
      .send({ content: "una respuesta", parent: root._id.toString() });
    expect(replyRes.status).toBe(201);
    expect(replyRes.body.parent).toBe(root._id.toString());

    const getRes = await request(app)
      .get(`/api/tables/${table._id}/comments`)
      .set("Authorization", `Bearer ${tokenFor(host)}`);
    expect(getRes.status).toBe(200);
    // Solo un comentario de nivel superior, con la respuesta anidada.
    expect(getRes.body).toHaveLength(1);
    expect(getRes.body[0]._id).toBe(root._id.toString());
    expect(getRes.body[0].replies).toHaveLength(1);
    expect(getRes.body[0].replies[0].content).toBe("una respuesta");
  });

  it("aplana la respuesta a una respuesta hacia el comentario raíz", async () => {
    const host = await createUser();
    const replier = await createAuthedUser();
    const table = await createTable(host, { privacy: "public" });

    const root = await Comment.create({
      table: table._id,
      author: host._id,
      content: "raíz",
    });
    const reply = await Comment.create({
      table: table._id,
      author: host._id,
      content: "respuesta 1",
      parent: root._id,
    });

    const res = await request(app)
      .post(`/api/tables/${table._id}/comments`)
      .set("Authorization", `Bearer ${replier.token}`)
      .send({
        content: "respuesta a la respuesta",
        parent: reply._id.toString(),
      });
    expect(res.status).toBe(201);
    // Se cuelga del raíz, no del comentario intermedio.
    expect(res.body.parent).toBe(root._id.toString());
  });

  it("400 si el comentario padre no pertenece a la mesa", async () => {
    const host = await createUser();
    const tableA = await createTable(host, { privacy: "public" });
    const tableB = await createTable(host, { privacy: "public" });
    const rootB = await Comment.create({
      table: tableB._id,
      author: host._id,
      content: "de otra mesa",
    });

    const res = await request(app)
      .post(`/api/tables/${tableA._id}/comments`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({ content: "respuesta cruzada", parent: rootB._id.toString() });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/padre inválido/i);
  });

  it("notifica al autor del comentario respondido aunque no sea host/jugador/seguidor", async () => {
    // Igual que en compartidas: una respuesta debe llegar al autor del
    // comentario original aunque ese usuario no sea miembro de la mesa.
    const host = await createUser();
    const commenter = await createAuthedUser(); // comenta pero NO es miembro
    const replier = await createAuthedUser();
    const table = await createTable(host, { privacy: "public" });

    // commenter (no-miembro) deja un comentario de nivel superior.
    const topRes = await request(app)
      .post(`/api/tables/${table._id}/comments`)
      .set("Authorization", `Bearer ${commenter.token}`)
      .send({ content: "hola desde un no-miembro" });
    expect(topRes.status).toBe(201);

    // replier responde ese comentario.
    const replyRes = await request(app)
      .post(`/api/tables/${table._id}/comments`)
      .set("Authorization", `Bearer ${replier.token}`)
      .send({ content: "te respondo", parent: topRes.body._id });
    expect(replyRes.status).toBe(201);

    // El autor del comentario original (no-miembro) recibió la notif.
    const notif = await Notification.findOne({
      recipient: commenter.user._id,
      type: "comment",
      tableId: table._id.toString(),
    });
    expect(notif).not.toBeNull();

    // El que respondió NO se notifica a sí mismo.
    const selfNotif = await Notification.findOne({
      recipient: replier.user._id,
      type: "comment",
    });
    expect(selfNotif).toBeNull();
  });

  it("borra en cascada las respuestas al eliminar el comentario raíz", async () => {
    const host = await createUser();
    const table = await createTable(host, { privacy: "public" });
    const root = await Comment.create({
      table: table._id,
      author: host._id,
      content: "raíz",
    });
    await Comment.create({
      table: table._id,
      author: host._id,
      content: "respuesta",
      parent: root._id,
    });

    const res = await request(app)
      .delete(`/api/tables/${table._id}/comments/${root._id}`)
      .set("Authorization", `Bearer ${tokenFor(host)}`);
    expect(res.status).toBe(200);

    const remaining = await Comment.countDocuments({ table: table._id });
    expect(remaining).toBe(0);
  });
});

describe("POST /api/tables/:id/comments/:commentId/like", () => {
  it("togglea el like (suma y resta) y devuelve {likes, liked}", async () => {
    const host = await createUser();
    const liker = await createAuthedUser();
    const table = await createTable(host, { privacy: "public" });
    const comment = await Comment.create({
      table: table._id,
      author: host._id,
      content: "comentario",
    });

    const add = await request(app)
      .post(`/api/tables/${table._id}/comments/${comment._id}/like`)
      .set("Authorization", `Bearer ${liker.token}`);
    expect(add.status).toBe(200);
    expect(add.body).toEqual({ likes: 1, liked: true });

    const remove = await request(app)
      .post(`/api/tables/${table._id}/comments/${comment._id}/like`)
      .set("Authorization", `Bearer ${liker.token}`);
    expect(remove.body).toEqual({ likes: 0, liked: false });
  });

  it("403 en mesa no pública", async () => {
    const host = await createUser();
    const liker = await createAuthedUser();
    const table = await createTable(host, { privacy: "private" });
    const comment = await Comment.create({
      table: table._id,
      author: host._id,
      content: "x",
    });
    const res = await request(app)
      .post(`/api/tables/${table._id}/comments/${comment._id}/like`)
      .set("Authorization", `Bearer ${liker.token}`);
    expect(res.status).toBe(403);
  });

  it("notifica al autor del comentario cuando lo likea otro (con notifId/count)", async () => {
    const host = await createUser();
    const liker = await createAuthedUser();
    const table = await createTable(host, { privacy: "public" });
    const comment = await Comment.create({
      table: table._id,
      author: host._id,
      content: "x",
    });
    await request(app)
      .post(`/api/tables/${table._id}/comments/${comment._id}/like`)
      .set("Authorization", `Bearer ${liker.token}`);

    const notif = await Notification.findOne({
      recipient: host._id,
      type: "comment_like",
    });
    expect(notif).not.toBeNull();
    expect(notif.commentId).toBe(comment._id.toString());
    expect(notif.tableId).toBe(table._id.toString());
    expect(notif.count).toBe(1);
  });

  it("no notifica al likear el propio comentario", async () => {
    const host = await createAuthedUser();
    const table = await createTable(host.user, { privacy: "public" });
    const comment = await Comment.create({
      table: table._id,
      author: host.user._id,
      content: "x",
    });
    await request(app)
      .post(`/api/tables/${table._id}/comments/${comment._id}/like`)
      .set("Authorization", `Bearer ${host.token}`);

    const count = await Notification.countDocuments({ type: "comment_like" });
    expect(count).toBe(0);
  });
});

describe("GET /api/tables/:id/comments/:commentId/likes", () => {
  it("devuelve los users que likearon (poblados)", async () => {
    const host = await createUser();
    const liker = await createAuthedUser({ username: "likeador" });
    const table = await createTable(host, { privacy: "public" });
    const comment = await Comment.create({
      table: table._id,
      author: host._id,
      content: "x",
      likes: [liker.user._id],
    });
    const res = await request(app)
      .get(`/api/tables/${table._id}/comments/${comment._id}/likes`)
      .set("Authorization", `Bearer ${tokenFor(host)}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].username).toBe("likeador");
  });

  it("la lista de comentarios incluye likeCount y liked", async () => {
    const host = await createAuthedUser();
    const table = await createTable(host.user, { privacy: "public" });
    await Comment.create({
      table: table._id,
      author: host.user._id,
      content: "x",
      likes: [host.user._id],
    });
    const res = await request(app)
      .get(`/api/tables/${table._id}/comments`)
      .set("Authorization", `Bearer ${host.token}`);
    expect(res.status).toBe(200);
    expect(res.body[0].likeCount).toBe(1);
    expect(res.body[0].liked).toBe(true);
    expect(res.body[0].likes).toBeUndefined();
  });
});
