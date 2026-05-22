/**
 * Tests para las Mesas del Evento (Fase 2).
 *
 * Cubre:
 *   - POST /api/tables con body.eventoId requiere canActInEvento + valida estado
 *   - GET /api/tables NO incluye mesas event-scoped (filtro implícito eventoId:null)
 *   - GET /api/eventos/:id/mesas devuelve solo las mesas del evento
 *   - Cascade: PUT evento status=cancelled cancela todas las mesas asociadas
 *   - Cascade: DELETE evento cancela todas las mesas asociadas
 */

const request = require("supertest");
const app = require("../../app");
const Table = require("../../models/Table");
const { createUser, createAuthedUser } = require("../helpers/auth");
const { createTable, createEvento } = require("../helpers/factories");
const SiteConfig = require("../../models/SiteConfig");
const { loadSiteConfig, updateSiteConfig } = require("../../utils/siteConfig");

async function enableAllSections() {
  // eventos + mesas both default-off para non-admins en site config seed.
  // Habilitamos cada sección para aislar los tests del gating.
  const all = {};
  for (const key of SiteConfig.SECTION_KEYS) all[key] = { enabled: true };
  await loadSiteConfig();
  await updateSiteConfig(all, null, null);
}

beforeEach(async () => {
  await enableAllSections();
});

describe("POST /api/tables — body.eventoId", () => {
  it("requires the eventoId to refer to an existing event", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catan",
        date: new Date(Date.now() + 86400000).toISOString(),
        maxPlayers: 4,
        eventoId: "ffffffffffffffffffffffff",
      });
    expect(res.status).toBe(404);
  });

  it("rejects strangers (no registration) with 403", async () => {
    const admin = await createUser({ isAdmin: true });
    const { token } = await createAuthedUser();
    const evento = await createEvento(admin);
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catan",
        date: new Date(Date.now() + 86400000).toISOString(),
        maxPlayers: 4,
        eventoId: evento._id.toString(),
      });
    expect(res.status).toBe(403);
  });

  it("rejects pending registrants (403)", async () => {
    const admin = await createUser({ isAdmin: true });
    const { user, token } = await createAuthedUser();
    const evento = await createEvento(admin, {
      registrations: [
        { user: user._id, status: "pending", submittedAt: new Date() },
      ],
    });
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catan",
        date: new Date(Date.now() + 86400000).toISOString(),
        maxPlayers: 4,
        eventoId: evento._id.toString(),
      });
    expect(res.status).toBe(403);
  });

  it("accepts confirmed registrants and persists eventoId", async () => {
    const admin = await createUser({ isAdmin: true });
    const { user, token } = await createAuthedUser();
    const evento = await createEvento(admin, {
      registrations: [
        { user: user._id, status: "confirmed", submittedAt: new Date() },
      ],
    });
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Wingspan",
        date: new Date(Date.now() + 86400000).toISOString(),
        maxPlayers: 4,
        eventoId: evento._id.toString(),
      });
    expect(res.status).toBe(201);
    expect(res.body.eventoId).toBe(evento._id.toString());
    const persisted = await Table.findById(res.body._id).lean();
    expect(persisted.eventoId.toString()).toBe(evento._id.toString());
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
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catan",
        date: new Date(Date.now() + 86400000).toISOString(),
        maxPlayers: 4,
        eventoId: evento._id.toString(),
      });
    expect(res.status).toBe(400);
  });

  it("creating a mesa WITHOUT eventoId still works (global mesa, eventoId=null)", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Global Game",
        date: new Date(Date.now() + 86400000).toISOString(),
        maxPlayers: 4,
      });
    expect(res.status).toBe(201);
    expect(res.body.eventoId).toBeNull();
  });
});

describe("GET /api/tables — excludes event-scoped tables", () => {
  it("only returns global mesas (eventoId=null), never event-scoped ones", async () => {
    const admin = await createUser({ isAdmin: true });
    const evento = await createEvento(admin);
    const globalTable = await createTable(admin, { boardGame: "Global" });
    await createTable(admin, {
      boardGame: "Del Evento",
      eventoId: evento._id,
    });

    const res = await request(app).get("/api/tables");
    expect(res.status).toBe(200);
    const ids = res.body.tables.map((t) => t._id);
    expect(ids).toContain(globalTable._id.toString());
    expect(res.body.tables.every((t) => !t.eventoId)).toBe(true);
  });
});

describe("GET /api/eventos/:id/mesas", () => {
  it("returns only mesas associated with the event", async () => {
    const admin = await createUser({ isAdmin: true });
    const evento = await createEvento(admin);
    await createTable(admin, { boardGame: "Global" });
    const eventoTable = await createTable(admin, {
      boardGame: "Del Evento",
      eventoId: evento._id,
    });

    const res = await request(app).get(`/api/eventos/${evento._id}/mesas`);
    expect(res.status).toBe(200);
    expect(res.body.tables).toHaveLength(1);
    expect(res.body.tables[0]._id).toBe(eventoTable._id.toString());
  });

  it("excludes cancelled mesas", async () => {
    const admin = await createUser({ isAdmin: true });
    const evento = await createEvento(admin);
    await createTable(admin, {
      boardGame: "Vivita",
      eventoId: evento._id,
    });
    await createTable(admin, {
      boardGame: "Cancelada",
      eventoId: evento._id,
      status: "cancelled",
    });

    const res = await request(app).get(`/api/eventos/${evento._id}/mesas`);
    expect(res.status).toBe(200);
    expect(res.body.tables).toHaveLength(1);
    expect(res.body.tables[0].boardGame).toBe("Vivita");
  });

  it("404 for drafts (non-admin)", async () => {
    const admin = await createUser({ isAdmin: true });
    const evento = await createEvento(admin, { status: "draft" });
    const res = await request(app).get(`/api/eventos/${evento._id}/mesas`);
    expect(res.status).toBe(404);
  });
});

describe("Cascade: cancel/delete event → cancel associated tables", () => {
  it("PUT evento status=cancelled cancels all event tables", async () => {
    const { user: admin, token } = await createAuthedUser({ isAdmin: true });
    const evento = await createEvento(admin);
    const t1 = await createTable(admin, {
      boardGame: "M1",
      eventoId: evento._id,
    });
    const t2 = await createTable(admin, {
      boardGame: "M2",
      eventoId: evento._id,
    });

    const res = await request(app)
      .put(`/api/eventos/${evento._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "cancelled" });
    expect(res.status).toBe(200);

    const after1 = await Table.findById(t1._id).lean();
    const after2 = await Table.findById(t2._id).lean();
    expect(after1.status).toBe("cancelled");
    expect(after2.status).toBe("cancelled");
  });

  it("PUT evento status=cancelled does NOT touch global tables", async () => {
    const { user: admin, token } = await createAuthedUser({ isAdmin: true });
    const evento = await createEvento(admin);
    const globalTable = await createTable(admin, { boardGame: "Global" });

    await request(app)
      .put(`/api/eventos/${evento._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "cancelled" });

    const after = await Table.findById(globalTable._id).lean();
    expect(after.status).not.toBe("cancelled");
  });

  it("DELETE evento cancels all event tables", async () => {
    const { user: admin, token } = await createAuthedUser({ isAdmin: true });
    const evento = await createEvento(admin);
    const t1 = await createTable(admin, {
      boardGame: "M1",
      eventoId: evento._id,
    });

    const res = await request(app)
      .delete(`/api/eventos/${evento._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const after = await Table.findById(t1._id).lean();
    expect(after.status).toBe("cancelled");
  });
});

describe("Notification: evento_mesa_created", () => {
  it("emits evento:notification to other confirmed registrants when a mesa is created in the event", async () => {
    global.__ioStub.__reset();
    const admin = await createUser({ isAdmin: true });
    const { user: actor, token } = await createAuthedUser();
    const otherConfirmed = await createUser();
    const evento = await createEvento(admin, {
      registrations: [
        { user: actor._id, status: "confirmed", submittedAt: new Date() },
        {
          user: otherConfirmed._id,
          status: "confirmed",
          submittedAt: new Date(),
        },
      ],
    });

    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catan",
        date: new Date(Date.now() + 86400000).toISOString(),
        maxPlayers: 4,
        eventoId: evento._id.toString(),
      });
    expect(res.status).toBe(201);

    // Otro confirmado recibe la notif; el actor NO.
    const notifEmits = global.__ioStub.emitted.filter(
      (e) => e.event === "evento:notification",
    );
    expect(notifEmits).toHaveLength(1);
    expect(notifEmits[0].room).toBe(`user:${otherConfirmed._id}`);
    expect(notifEmits[0].payload.type).toBe("evento_mesa_created");
    expect(notifEmits[0].payload.gameName).toBe("Catan");
    expect(notifEmits[0].payload.notifId).toBeDefined();
    expect(notifEmits[0].payload.count).toBe(1);

    // Broadcast al room del evento (no es notif persistente).
    const broadcasts = global.__ioStub.emitted.filter(
      (e) => e.event === "evento:mesa-created",
    );
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0].room).toBe(`evento:${evento._id}`);
  });
});
