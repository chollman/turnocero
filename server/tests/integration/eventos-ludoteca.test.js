/**
 * Tests para la Ludoteca del Evento (Fase 2).
 *
 * Cubre:
 *   - GET /api/eventos/:id/ludoteca — público (eventos open/closed)
 *   - POST /:id/ludoteca — permisos (canActInEvento) + dedupe + hidratación BGG
 *   - PATCH /:id/ludoteca/:itemId — solo owner o admin
 *   - DELETE /:id/ludoteca/:itemId — solo owner o admin
 *
 * Mockea `resolveGame` sembrando un BggGame doc — resolveGame consulta L1
 * (memoria) → L2 (Mongo). Sin la entrada en Mongo, intentaría llegar a BGG
 * (network). Sembrar evita la red y deja el test determinístico.
 */

const request = require("supertest");
const app = require("../../app");
const BggGame = require("../../models/BggGame");
const Evento = require("../../models/Evento");
const bggRouter = require("../../routes/bgg");
const { createUser, createAuthedUser, tokenFor } = require("../helpers/auth");
const { createEvento } = require("../helpers/factories");
const { loadSiteConfig, updateSiteConfig } = require("../../utils/siteConfig");

async function ensureEventosSectionOn() {
  await loadSiteConfig();
  await updateSiteConfig({ eventos: { enabled: true } }, null, null);
}

async function seedBggGame(overrides = {}) {
  return BggGame.create({
    gameId: 13,
    name: "Catan",
    thumbnail: "https://cf.geekdo-images.com/thumb.jpg",
    image: "https://cf.geekdo-images.com/full.jpg",
    yearPublished: 1995,
    minPlayers: 3,
    maxPlayers: 4,
    ...overrides,
  });
}

beforeEach(async () => {
  await ensureEventosSectionOn();
  bggRouter.__resetCache(); // limpiar L1 entre tests
});

describe("GET /api/eventos/:id/ludoteca", () => {
  it("returns empty items array for a new event", async () => {
    const admin = await createUser({ isAdmin: true });
    const evento = await createEvento(admin);
    const res = await request(app).get(`/api/eventos/${evento._id}/ludoteca`);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("returns items with addedBy populated", async () => {
    const admin = await createUser({ isAdmin: true });
    const adder = await createUser({ username: "alice" });
    const evento = await Evento.create({
      author: admin._id,
      title: "T",
      eventDate: new Date(Date.now() + 7 * 86400000),
      location: { texto: "BA" },
      status: "open",
      ludoteca: [
        {
          bggGameId: 13,
          gameName: "Catan",
          thumbnail: "",
          image: "",
          year: 1995,
          minPlayers: 3,
          maxPlayers: 4,
          addedBy: adder._id,
          notes: "Llevo mi copia",
        },
      ],
    });
    const res = await request(app).get(`/api/eventos/${evento._id}/ludoteca`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].addedBy.username).toBe("alice");
    expect(res.body.items[0].notes).toBe("Llevo mi copia");
  });

  it("404 for drafts (non-admin)", async () => {
    const admin = await createUser({ isAdmin: true });
    const evento = await createEvento(admin, { status: "draft" });
    const res = await request(app).get(`/api/eventos/${evento._id}/ludoteca`);
    expect(res.status).toBe(404);
  });

  it("admin can read draft ludoteca", async () => {
    const { user: admin, token } = await createAuthedUser({ isAdmin: true });
    const evento = await createEvento(admin, { status: "draft" });
    const res = await request(app)
      .get(`/api/eventos/${evento._id}/ludoteca`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/eventos/:id/ludoteca — permisos", () => {
  it("requires auth", async () => {
    const admin = await createUser({ isAdmin: true });
    const evento = await createEvento(admin);
    const res = await request(app)
      .post(`/api/eventos/${evento._id}/ludoteca`)
      .send({ bggGameId: 13 });
    expect(res.status).toBe(401);
  });

  it("rejects pending registrants (403)", async () => {
    const admin = await createUser({ isAdmin: true });
    const { user, token } = await createAuthedUser();
    const evento = await createEvento(admin, {
      registrations: [
        { user: user._id, status: "pending", submittedAt: new Date() },
      ],
    });
    await seedBggGame();
    const res = await request(app)
      .post(`/api/eventos/${evento._id}/ludoteca`)
      .set("Authorization", `Bearer ${token}`)
      .send({ bggGameId: 13 });
    expect(res.status).toBe(403);
  });

  it("rejects strangers without registration (403)", async () => {
    const admin = await createUser({ isAdmin: true });
    const { token } = await createAuthedUser();
    const evento = await createEvento(admin);
    await seedBggGame();
    const res = await request(app)
      .post(`/api/eventos/${evento._id}/ludoteca`)
      .set("Authorization", `Bearer ${token}`)
      .send({ bggGameId: 13 });
    expect(res.status).toBe(403);
  });

  it("accepts confirmed registrants", async () => {
    const admin = await createUser({ isAdmin: true });
    const { user, token } = await createAuthedUser();
    const evento = await createEvento(admin, {
      registrations: [
        { user: user._id, status: "confirmed", submittedAt: new Date() },
      ],
    });
    await seedBggGame();
    const res = await request(app)
      .post(`/api/eventos/${evento._id}/ludoteca`)
      .set("Authorization", `Bearer ${token}`)
      .send({ bggGameId: 13, notes: "Lo traigo yo" });
    expect(res.status).toBe(201);
    expect(res.body.item.gameName).toBe("Catan");
    expect(res.body.item.notes).toBe("Lo traigo yo");
    expect(res.body.item.bggGameId).toBe(13);
    expect(res.body.item.minPlayers).toBe(3);
    expect(res.body.item.maxPlayers).toBe(4);
  });

  it("accepts the event author even without registration", async () => {
    const { user: author, token } = await createAuthedUser({ isAdmin: false });
    const evento = await createEvento(author);
    await seedBggGame();
    const res = await request(app)
      .post(`/api/eventos/${evento._id}/ludoteca`)
      .set("Authorization", `Bearer ${token}`)
      .send({ bggGameId: 13 });
    expect(res.status).toBe(201);
  });

  it("accepts site admins even without registration", async () => {
    const author = await createUser();
    const { token } = await createAuthedUser({ isAdmin: true });
    const evento = await createEvento(author);
    await seedBggGame();
    const res = await request(app)
      .post(`/api/eventos/${evento._id}/ludoteca`)
      .set("Authorization", `Bearer ${token}`)
      .send({ bggGameId: 13 });
    expect(res.status).toBe(201);
  });
});

describe("POST /api/eventos/:id/ludoteca — validaciones", () => {
  async function setupConfirmed() {
    const admin = await createUser({ isAdmin: true });
    const { user, token } = await createAuthedUser();
    const evento = await createEvento(admin, {
      registrations: [
        { user: user._id, status: "confirmed", submittedAt: new Date() },
      ],
    });
    return { evento, token, user };
  }

  it("400 on invalid bggGameId", async () => {
    const { evento, token } = await setupConfirmed();
    const res = await request(app)
      .post(`/api/eventos/${evento._id}/ludoteca`)
      .set("Authorization", `Bearer ${token}`)
      .send({ bggGameId: "no-numero" });
    expect(res.status).toBe(400);
  });

  it("400 on notes too long (>200 chars)", async () => {
    const { evento, token } = await setupConfirmed();
    await seedBggGame();
    const res = await request(app)
      .post(`/api/eventos/${evento._id}/ludoteca`)
      .set("Authorization", `Bearer ${token}`)
      .send({ bggGameId: 13, notes: "x".repeat(201) });
    expect(res.status).toBe(400);
  });

  it("400 when the event is cancelled", async () => {
    const admin = await createUser({ isAdmin: true });
    const { user, token } = await createAuthedUser();
    const evento = await createEvento(admin, {
      status: "cancelled",
      registrations: [
        { user: user._id, status: "confirmed", submittedAt: new Date() },
      ],
    });
    await seedBggGame();
    const res = await request(app)
      .post(`/api/eventos/${evento._id}/ludoteca`)
      .set("Authorization", `Bearer ${token}`)
      .send({ bggGameId: 13 });
    expect(res.status).toBe(400);
  });

  it("409 when the same user adds the same game twice (dedupe)", async () => {
    const { evento, token } = await setupConfirmed();
    await seedBggGame();
    await request(app)
      .post(`/api/eventos/${evento._id}/ludoteca`)
      .set("Authorization", `Bearer ${token}`)
      .send({ bggGameId: 13 });
    const res = await request(app)
      .post(`/api/eventos/${evento._id}/ludoteca`)
      .set("Authorization", `Bearer ${token}`)
      .send({ bggGameId: 13 });
    expect(res.status).toBe(409);
  });

  it("allows different users to add the same game", async () => {
    const admin = await createUser({ isAdmin: true });
    const userA = await createUser();
    const userB = await createUser();
    const evento = await createEvento(admin, {
      registrations: [
        { user: userA._id, status: "confirmed", submittedAt: new Date() },
        { user: userB._id, status: "confirmed", submittedAt: new Date() },
      ],
    });
    await seedBggGame();
    const ra = await request(app)
      .post(`/api/eventos/${evento._id}/ludoteca`)
      .set("Authorization", `Bearer ${tokenFor(userA)}`)
      .send({ bggGameId: 13 });
    const rb = await request(app)
      .post(`/api/eventos/${evento._id}/ludoteca`)
      .set("Authorization", `Bearer ${tokenFor(userB)}`)
      .send({ bggGameId: 13 });
    expect(ra.status).toBe(201);
    expect(rb.status).toBe(201);
    const refreshed = await Evento.findById(evento._id).lean();
    expect(refreshed.ludoteca).toHaveLength(2);
  });
});

describe("PATCH /api/eventos/:id/ludoteca/:itemId — editar notas", () => {
  async function setupItem() {
    const admin = await createUser({ isAdmin: true });
    const { user: adder, token } = await createAuthedUser();
    const evento = await createEvento(admin, {
      registrations: [
        { user: adder._id, status: "confirmed", submittedAt: new Date() },
      ],
    });
    await seedBggGame();
    await request(app)
      .post(`/api/eventos/${evento._id}/ludoteca`)
      .set("Authorization", `Bearer ${token}`)
      .send({ bggGameId: 13 });
    const refreshed = await Evento.findById(evento._id);
    return {
      evento,
      itemId: refreshed.ludoteca[0]._id.toString(),
      adder,
      token,
    };
  }

  it("owner can edit notes", async () => {
    const { evento, itemId, token } = await setupItem();
    const res = await request(app)
      .patch(`/api/eventos/${evento._id}/ludoteca/${itemId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ notes: "Actualizado" });
    expect(res.status).toBe(200);
    expect(res.body.item.notes).toBe("Actualizado");
  });

  it("site admin can edit notes of another user", async () => {
    const { evento, itemId } = await setupItem();
    const { token: adminToken } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .patch(`/api/eventos/${evento._id}/ludoteca/${itemId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ notes: "Moderado" });
    expect(res.status).toBe(200);
  });

  it("403 for a stranger trying to edit", async () => {
    const { evento, itemId } = await setupItem();
    const { token: otherToken } = await createAuthedUser();
    const res = await request(app)
      .patch(`/api/eventos/${evento._id}/ludoteca/${itemId}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ notes: "Hack" });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/eventos/:id/ludoteca/:itemId — quitar juego", () => {
  async function setupItem() {
    const admin = await createUser({ isAdmin: true });
    const { user: adder, token } = await createAuthedUser();
    const evento = await createEvento(admin, {
      registrations: [
        { user: adder._id, status: "confirmed", submittedAt: new Date() },
      ],
    });
    await seedBggGame();
    await request(app)
      .post(`/api/eventos/${evento._id}/ludoteca`)
      .set("Authorization", `Bearer ${token}`)
      .send({ bggGameId: 13 });
    const refreshed = await Evento.findById(evento._id);
    return {
      evento,
      itemId: refreshed.ludoteca[0]._id.toString(),
      token,
    };
  }

  it("owner can delete their own item", async () => {
    const { evento, itemId, token } = await setupItem();
    const res = await request(app)
      .delete(`/api/eventos/${evento._id}/ludoteca/${itemId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.removed).toBe(itemId);
    const refreshed = await Evento.findById(evento._id).lean();
    expect(refreshed.ludoteca).toHaveLength(0);
  });

  it("403 for a stranger", async () => {
    const { evento, itemId } = await setupItem();
    const { token: otherToken } = await createAuthedUser();
    const res = await request(app)
      .delete(`/api/eventos/${evento._id}/ludoteca/${itemId}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  it("admin can delete any item", async () => {
    const { evento, itemId } = await setupItem();
    const { token: adminToken } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .delete(`/api/eventos/${evento._id}/ludoteca/${itemId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it("404 when itemId does not exist", async () => {
    const { evento, token } = await setupItem();
    const fakeId = "ffffffffffffffffffffffff";
    const res = await request(app)
      .delete(`/api/eventos/${evento._id}/ludoteca/${fakeId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
