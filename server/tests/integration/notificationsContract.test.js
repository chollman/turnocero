/**
 * Verifica el contrato real-time post-emitNotification:
 *
 *   - Cada socket event emitido para una notificación persistida incluye
 *     `notifId` (string del Notification _id) y `count` (absoluto, post-upsert).
 *   - Tipos agregables (chat, comment, image, join_request, dm, admin_chat,
 *     compartida_*) bumpean el count en el server y reflejan ese count en el
 *     payload — el cliente NO incrementa.
 *   - Gaps cerrados: `table_cancelled` y `evento_reminder` emiten socket
 *     (regresión del audit que detectó que no lo hacían).
 */

const request = require("supertest");
const app = require("../../app");
const Compartida = require("../../models/Compartida");
const Evento = require("../../models/Evento");
const { createAuthedUser, createUser, tokenFor } = require("../helpers/auth");
const { createTable } = require("../helpers/factories");
const eventoReminders = require("../../jobs/eventoReminders");
const SiteConfig = require("../../models/SiteConfig");
const { loadSiteConfig, updateSiteConfig } = require("../../utils/siteConfig");

function lastEmitFor(event) {
  const matches = global.__ioStub.emitted.filter((e) => e.event === event);
  return matches[matches.length - 1] || null;
}
function emitsFor(event) {
  return global.__ioStub.emitted.filter((e) => e.event === event);
}

beforeEach(async () => {
  global.__ioStub.__reset();
  // SiteConfig default tiene `mesas`, `torneos`, `miFeed` con enabled:false —
  // saveNotification cortaría las notifs de mesas para non-admins. Habilitamos
  // todo para que los tests ejerciten el pipeline de emit aislado del gating.
  const all = {};
  for (const key of SiteConfig.SECTION_KEYS) all[key] = { enabled: true };
  await loadSiteConfig();
  await updateSiteConfig(all, null, null);
});

describe("Real-time notification contract — every emit includes notifId + count", () => {
  describe("Mesas — chat:notification (aggregating)", () => {
    it("first chat message emits with count=1 and notifId", async () => {
      const { user: host, token } = await createAuthedUser();
      const sender = await createUser();
      // El host es separado de `players` en el modelo; agregarlo a players
      // duplicaría el participantIds y emitiría 2 veces al mismo recipient.
      const table = await createTable(host, { players: [sender._id] });
      const senderToken = tokenFor(sender);

      const res = await request(app)
        .post(`/api/tables/${table._id}/messages`)
        .set("Authorization", `Bearer ${senderToken}`)
        .send({ content: "hola" });
      if (res.status !== 201)
        throw new Error(
          `POST messages failed: ${res.status} ${JSON.stringify(res.body)}`,
        );

      const emit = lastEmitFor("chat:notification");
      expect(emit).not.toBeNull();
      expect(emit.room).toBe(`user:${host._id}`);
      expect(emit.payload.notifId).toBeDefined();
      expect(emit.payload.count).toBe(1);
      expect(emit.payload.timestamp).toBeDefined();
      expect(emit.payload.senderUsername).toBe(sender.username);

      // Use the token to keep the test self-contained
      void token;
    });

    it("second chat message bumps count to 2 in the emit payload", async () => {
      const host = await createUser();
      const sender = await createUser();
      const table = await createTable(host, { players: [sender._id] });
      const senderToken = tokenFor(sender);

      await request(app)
        .post(`/api/tables/${table._id}/messages`)
        .set("Authorization", `Bearer ${senderToken}`)
        .send({ content: "1" });
      await request(app)
        .post(`/api/tables/${table._id}/messages`)
        .set("Authorization", `Bearer ${senderToken}`)
        .send({ content: "2" });

      const emits = emitsFor("chat:notification");
      expect(emits.length).toBe(2);
      expect(emits[0].payload.count).toBe(1);
      expect(emits[1].payload.count).toBe(2);
      // Same notifId across the two emits (same notification doc, just $inc'd)
      expect(emits[0].payload.notifId).toBe(emits[1].payload.notifId);
    });
  });

  describe("Amigos — friend:request (aggregating per fromUserId)", () => {
    it("emits notifId + count on friend:request", async () => {
      const { user: from, token: fromToken } = await createAuthedUser();
      const target = await createUser();
      const res = await request(app)
        .post(`/api/friends/${target._id}/request`)
        .set("Authorization", `Bearer ${fromToken}`);
      if (res.status !== 200)
        throw new Error(
          `friend request failed: ${res.status} ${JSON.stringify(res.body)}`,
        );

      const emit = lastEmitFor("friend:request");
      expect(emit).not.toBeNull();
      expect(emit.room).toBe(`user:${target._id}`);
      expect(emit.payload.notifId).toBeDefined();
      expect(emit.payload.count).toBe(1);
      expect(emit.payload.fromUserId).toBe(from._id.toString());
    });
  });

  describe("Compartidas — like (aggregating)", () => {
    it("emits notifId + count on compartida:like", async () => {
      const author = await createUser();
      const { user: liker, token } = await createAuthedUser();
      const comp = await Compartida.create({
        author: author._id,
        title: "Mi partida",
        body: "genial",
        privacy: "public",
      });

      await request(app)
        .post(`/api/compartidas/${comp._id}/like`)
        .set("Authorization", `Bearer ${token}`);

      const emit = lastEmitFor("compartida:like");
      expect(emit).not.toBeNull();
      expect(emit.room).toBe(`user:${author._id}`);
      expect(emit.payload.notifId).toBeDefined();
      expect(emit.payload.count).toBe(1);
      expect(emit.payload.fromUsername).toBe(liker.username);
    });
  });

  describe("Eventos — evento:notification (non-aggregating)", () => {
    it("confirm registration emits notifId + count=1 with type discriminator", async () => {
      const { user: admin, token: adminToken } = await createAuthedUser({
        isAdmin: true,
      });
      const registrant = await createUser();
      const evento = await Evento.create({
        title: "Torneo Magic",
        description: "",
        eventDate: new Date(Date.now() + 7 * 86400000),
        location: { texto: "BA" },
        author: admin._id,
        status: "open",
        registrations: [
          {
            user: registrant._id,
            status: "pending",
            submittedAt: new Date(),
          },
        ],
      });

      await request(app)
        .patch(
          `/api/eventos/${evento._id}/inscripciones/${registrant._id}/confirmar`,
        )
        .set("Authorization", `Bearer ${adminToken}`);

      const emit = lastEmitFor("evento:notification");
      expect(emit).not.toBeNull();
      expect(emit.room).toBe(`user:${registrant._id}`);
      expect(emit.payload.notifId).toBeDefined();
      expect(emit.payload.count).toBe(1);
      expect(emit.payload.type).toBe("evento_confirmed");
      expect(emit.payload.eventoId).toBe(evento._id.toString());
    });
  });

  describe("GAP CERRADO — table_cancelled emits socket event", () => {
    it("cancelling a table emits table:cancelled to each member/follower with notifId + count", async () => {
      const { user: host, token: hostToken } = await createAuthedUser();
      const player = await createUser();
      const follower = await createUser();
      const table = await createTable(host, {
        players: [player._id],
        followers: [follower._id],
      });

      await request(app)
        .delete(`/api/tables/${table._id}`)
        .set("Authorization", `Bearer ${hostToken}`);

      const emits = emitsFor("table:cancelled");
      // Host excluded — only player + follower
      expect(emits.length).toBe(2);
      const rooms = emits.map((e) => e.room).sort();
      expect(rooms).toContain(`user:${player._id}`);
      expect(rooms).toContain(`user:${follower._id}`);
      for (const emit of emits) {
        expect(emit.payload.notifId).toBeDefined();
        expect(emit.payload.count).toBe(1);
        expect(emit.payload.tableName).toBe("Catán");
      }
    });
  });

  describe("GAP CERRADO — evento_reminder cron emits socket event", () => {
    it("runOnce({io}) emits evento:notification with type=evento_reminder + notifId + count", async () => {
      const admin = await createUser({ isAdmin: true });
      const registrant = await createUser({ eventoReminderHours: 24 });
      const eventDate = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23h ahead
      const evento = await Evento.create({
        title: "Próximamente",
        description: "",
        eventDate,
        location: { texto: "BA" },
        author: admin._id,
        status: "open",
        registrations: [
          {
            user: registrant._id,
            status: "confirmed",
            submittedAt: new Date(),
          },
        ],
      });

      const result = await eventoReminders.runOnce({ io: global.__ioStub });
      expect(result.notifsCreated).toBeGreaterThanOrEqual(1);

      const emit = lastEmitFor("evento:notification");
      expect(emit).not.toBeNull();
      expect(emit.room).toBe(`user:${registrant._id}`);
      expect(emit.payload.notifId).toBeDefined();
      expect(emit.payload.count).toBe(1);
      expect(emit.payload.type).toBe("evento_reminder");
      expect(emit.payload.eventoId).toBe(evento._id.toString());
    });

    it("runOnce() sin io aún persiste la notif (degraded mode)", async () => {
      const admin = await createUser({ isAdmin: true });
      const registrant = await createUser({ eventoReminderHours: 24 });
      await Evento.create({
        title: "Sin socket",
        description: "",
        eventDate: new Date(Date.now() + 23 * 60 * 60 * 1000),
        location: { texto: "BA" },
        author: admin._id,
        status: "open",
        registrations: [
          {
            user: registrant._id,
            status: "confirmed",
            submittedAt: new Date(),
          },
        ],
      });

      const result = await eventoReminders.runOnce(); // sin io
      expect(result.notifsCreated).toBeGreaterThanOrEqual(1);
      // No emit (io faltante) — notif persistida igual.
      expect(emitsFor("evento:notification")).toHaveLength(0);
    });
  });
});
