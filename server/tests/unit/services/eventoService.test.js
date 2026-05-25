const mongoose = require("mongoose");
const Evento = require("../../../models/Evento");
const Table = require("../../../models/Table");
const Notification = require("../../../models/Notification");
const {
  loadSiteConfig,
  updateSiteConfig,
} = require("../../../utils/siteConfig");
const {
  countsFor,
  notifyOne,
  notifyActiveRegistrations,
  cancelAssociatedTables,
  reloadRegPopulated,
  closePastOpenEvents,
} = require("../../../services/eventoService");

const oid = () => new mongoose.Types.ObjectId();

// Algunas notifs de tipos `mesas`/`eventos` se descartan en saveNotification
// si la sección está OFF. Defaults persisten admin-only-ness para 'mesas';
// activamos lo que el test necesita antes de cada caso.
beforeEach(async () => {
  await loadSiteConfig();
  await updateSiteConfig(
    { mesas: { enabled: true }, eventos: { enabled: true } },
    null,
    null,
  );
});

// Mínimo req mock con app.get('io') que el utils/emitNotification necesita.
function makeReq() {
  global.__ioStub?.__reset?.();
  return {
    app: {
      get: (key) => (key === "io" ? global.__ioStub : null),
    },
  };
}

function makeEvento(overrides = {}) {
  return new Evento({
    title: "Mi evento",
    eventDate: new Date(Date.now() + 7 * 86400000),
    author: oid(),
    location: { texto: "CABA", lat: null, lng: null },
    status: "open",
    registrations: [],
    ...overrides,
  });
}

describe("countsFor", () => {
  it("cuenta total/pending/confirmed correctamente", () => {
    const evento = {
      registrations: [
        { status: "pending" },
        { status: "pending" },
        { status: "confirmed" },
        { status: "rejected" },
      ],
    };
    expect(countsFor(evento)).toEqual({
      total: 4,
      pending: 2,
      confirmed: 1,
    });
  });

  it("retorna 0s para evento sin registrations", () => {
    expect(countsFor({})).toEqual({ total: 0, pending: 0, confirmed: 0 });
    expect(countsFor({ registrations: [] })).toEqual({
      total: 0,
      pending: 0,
      confirmed: 0,
    });
  });
});

describe("notifyOne", () => {
  it("no notifica si recipientId es null/undefined", async () => {
    const req = makeReq();
    await notifyOne(req, null, "evento_confirmed", {});
    await notifyOne(req, undefined, "evento_confirmed", {});
    const persisted = await Notification.find({});
    expect(persisted).toHaveLength(0);
  });

  it("no notifica si recipientId === actorId (no auto-notif)", async () => {
    const req = makeReq();
    const userId = oid();
    await notifyOne(req, userId, "evento_confirmed", {}, userId);
    const persisted = await Notification.find({});
    expect(persisted).toHaveLength(0);
  });

  it("persiste notif y emite por socket cuando es distinto del actor", async () => {
    const req = makeReq();
    const recipient = oid();
    const actor = oid();
    await notifyOne(
      req,
      recipient,
      "evento_confirmed",
      { eventoId: "e1", eventoTitle: "x" },
      actor,
    );
    const persisted = await Notification.find({ recipient });
    expect(persisted).toHaveLength(1);
    expect(persisted[0].type).toBe("evento_confirmed");
    const emits = global.__ioStub.emitted.filter(
      (e) => e.event === "evento:notification",
    );
    expect(emits.length).toBeGreaterThan(0);
  });
});

describe("notifyActiveRegistrations", () => {
  it("notifica solo a inscriptos confirmed + pending (no rejected)", async () => {
    const req = makeReq();
    const u1 = oid();
    const u2 = oid();
    const u3 = oid();
    const evento = await makeEvento({
      registrations: [
        { user: u1, status: "confirmed" },
        { user: u2, status: "pending" },
        { user: u3, status: "rejected" },
      ],
    }).save();
    await notifyActiveRegistrations(req, evento, "evento_updated", {
      changedFields: ["eventDate"],
    });
    const persisted = await Notification.find({});
    const recipientIds = persisted.map((n) => n.recipient.toString()).sort();
    expect(recipientIds).toEqual([u1.toString(), u2.toString()].sort());
  });

  it("excluye al actor si lo provee", async () => {
    const req = makeReq();
    const actor = oid();
    const other = oid();
    const evento = await makeEvento({
      registrations: [
        { user: actor, status: "confirmed" },
        { user: other, status: "confirmed" },
      ],
    }).save();
    await notifyActiveRegistrations(req, evento, "evento_updated", {}, actor);
    const persisted = await Notification.find({});
    expect(persisted).toHaveLength(1);
    expect(persisted[0].recipient.toString()).toBe(other.toString());
  });
});

describe("cancelAssociatedTables", () => {
  it("es no-op si no hay mesas asociadas", async () => {
    const req = makeReq();
    await expect(cancelAssociatedTables(req, oid())).resolves.toBeUndefined();
  });

  it("cancela mesas con eventoId que matchea y emite notifs a participantes", async () => {
    const req = makeReq();
    const eventoId = oid();
    const host = oid();
    const player1 = oid();
    const follower1 = oid();
    const otherEventoId = oid();

    const t1 = await Table.create({
      boardGame: "Catan",
      date: new Date(Date.now() + 86400000),
      maxPlayers: 4,
      host,
      players: [player1],
      followers: [follower1],
      eventoId,
      status: "open",
    });
    // Mesa de otro evento — no debe tocarse.
    await Table.create({
      boardGame: "Risk",
      date: new Date(Date.now() + 86400000),
      maxPlayers: 4,
      host: oid(),
      players: [],
      followers: [],
      eventoId: otherEventoId,
      status: "open",
    });

    await cancelAssociatedTables(req, eventoId);

    const refreshed = await Table.findById(t1._id);
    expect(refreshed.status).toBe("cancelled");
    const otra = await Table.findOne({ eventoId: otherEventoId });
    expect(otra.status).toBe("open");

    // Notifs para host + player + follower (3 únicos).
    const notifs = await Notification.find({ type: "table_cancelled" });
    const recipientIds = notifs.map((n) => n.recipient.toString()).sort();
    expect(recipientIds).toEqual(
      [host.toString(), player1.toString(), follower1.toString()].sort(),
    );
  });

  it("no toca mesas que ya están canceladas (idempotente)", async () => {
    const req = makeReq();
    const eventoId = oid();
    await Table.create({
      boardGame: "Catan",
      date: new Date(),
      maxPlayers: 4,
      host: oid(),
      players: [],
      followers: [],
      eventoId,
      status: "cancelled",
    });
    await cancelAssociatedTables(req, eventoId);
    const notifs = await Notification.find({});
    expect(notifs).toHaveLength(0);
  });
});

describe("reloadRegPopulated", () => {
  it("devuelve la subdoc con user populated en forma plana", async () => {
    const User = require("../../../models/User");
    const user = await User.create({
      username: "alice",
      displayName: "Alice",
      email: "a@a.com",
      password: `Passw0rd!${"x".repeat(50)}`,
      isVerified: true,
    });
    const evento = await makeEvento({
      registrations: [{ user: user._id, status: "confirmed" }],
    }).save();
    const reg = evento.registrations[0];

    const result = await reloadRegPopulated(evento, reg._id);
    expect(result.status).toBe("confirmed");
    expect(result.user.username).toBe("alice");
    expect(result.user._id.toString()).toBe(user._id.toString());
  });

  it("devuelve null si la regId no existe", async () => {
    const evento = await makeEvento().save();
    const result = await reloadRegPopulated(evento, oid());
    expect(result).toBeNull();
  });
});

describe("closePastOpenEvents", () => {
  it("cierra eventos abiertos con eventDate pasada", async () => {
    const pastOpen = await makeEvento({
      title: "Pasado",
      eventDate: new Date(Date.now() - 86400000),
      status: "open",
    }).save();
    const futureOpen = await makeEvento({
      title: "Futuro",
      eventDate: new Date(Date.now() + 86400000),
      status: "open",
    }).save();

    await closePastOpenEvents(makeReq());

    const refreshedPast = await Evento.findById(pastOpen._id);
    const refreshedFuture = await Evento.findById(futureOpen._id);
    expect(refreshedPast.status).toBe("closed");
    expect(refreshedFuture.status).toBe("open");
  });

  it("emite evento:updated por cada item cerrado si req se provee", async () => {
    await makeEvento({
      eventDate: new Date(Date.now() - 86400000),
      status: "open",
    }).save();
    const req = makeReq();
    await closePastOpenEvents(req);

    const updates = global.__ioStub.emitted.filter(
      (e) => e.event === "evento:updated",
    );
    expect(updates.length).toBeGreaterThan(0);
    // Cada item cerrado emite a su room + al listado público.
    const rooms = updates.map((e) => e.room);
    expect(rooms).toContain("eventos:list");
  });

  it("sin req no emite pero igual persiste status", async () => {
    const ev = await makeEvento({
      eventDate: new Date(Date.now() - 86400000),
      status: "open",
    }).save();
    await closePastOpenEvents();
    const refreshed = await Evento.findById(ev._id);
    expect(refreshed.status).toBe("closed");
  });

  it("ignora eventos ya cerrados (idempotente)", async () => {
    await makeEvento({
      eventDate: new Date(Date.now() - 86400000),
      status: "closed",
    }).save();
    const req = makeReq();
    await closePastOpenEvents(req);
    const updates = global.__ioStub.emitted.filter(
      (e) => e.event === "evento:updated",
    );
    expect(updates).toHaveLength(0);
  });
});
