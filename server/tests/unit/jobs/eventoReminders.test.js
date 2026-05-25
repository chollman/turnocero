const { runOnce } = require("../../../jobs/eventoReminders");
const Evento = require("../../../models/Evento");
const Notification = require("../../../models/Notification");
const { createUser } = require("../../helpers/auth");

// Estos tests corren contra el Mongo in-memory normal del setup global.
// Antes de cada test reseteamos via el afterEach del setup.

describe("eventoReminders.runOnce", () => {
  // Helper: crear un evento con fecha exacta y registrations dadas.
  async function createEventoAt(host, eventDate, regs = [], overrides = {}) {
    return Evento.create({
      title: "Test",
      eventDate,
      author: host._id,
      status: "open",
      registrations: regs,
      location: { texto: "X", lat: null, lng: null, displayName: "" },
      ...overrides,
    });
  }

  it("notifies confirmed registrants of events 24h ahead", async () => {
    const admin = await createUser({ isAdmin: true });
    const userA = await createUser();
    const userB = await createUser();
    const now = new Date("2027-06-12T12:00:00Z");
    const inWindow = new Date("2027-06-13T13:00:00Z"); // 25h ahead — dentro de la ventana

    await createEventoAt(admin, inWindow, [
      { user: userA._id, status: "confirmed" },
      { user: userB._id, status: "confirmed" },
    ]);

    const result = await runOnce({ now });
    expect(result.scanned).toBe(1);
    expect(result.notifsCreated).toBe(2);

    const notifsA = await Notification.find({
      recipient: userA._id,
      type: "evento_reminder",
    });
    expect(notifsA.length).toBe(1);
    expect(notifsA[0].eventoTitle).toBe("Test");
  });

  it("does NOT notify pending or rejected registrations", async () => {
    const admin = await createUser({ isAdmin: true });
    const userA = await createUser();
    const userB = await createUser();
    const now = new Date("2027-06-12T12:00:00Z");
    const inWindow = new Date("2027-06-13T13:00:00Z");

    await createEventoAt(admin, inWindow, [
      { user: userA._id, status: "pending" },
      { user: userB._id, status: "rejected" },
    ]);

    const result = await runOnce({ now });
    expect(result.notifsCreated).toBe(0);

    const allNotifs = await Notification.find({ type: "evento_reminder" });
    expect(allNotifs.length).toBe(0);
  });

  it("does NOT notify events outside the [now, now+25h] window", async () => {
    const admin = await createUser({ isAdmin: true });
    const user = await createUser();
    const now = new Date("2027-06-12T12:00:00Z");
    // Far future (más de 25h)
    const farAway = new Date("2027-06-20T12:00:00Z");
    // Already past
    const past = new Date("2027-06-10T12:00:00Z");

    await createEventoAt(admin, farAway, [
      { user: user._id, status: "confirmed" },
    ]);
    await createEventoAt(admin, past, [
      { user: user._id, status: "confirmed" },
    ]);

    const result = await runOnce({ now });
    expect(result.notifsCreated).toBe(0);
  });

  it("B5 — eventos atrasados (cron tardó) entran al rango y reciben reminder (no se pierden)", async () => {
    const admin = await createUser({ isAdmin: true });
    const user = await createUser();
    // El cron debería haber corrido a las 12:00 pero corrió a las 14:00 (2h tarde).
    // Evento a las 13:00 — ya pasó la ventana clásica [+23h, +25h] del cron viejo.
    const now = new Date("2027-06-12T14:00:00Z");
    const eventoAt = new Date("2027-06-13T13:00:00Z"); // ~23h adelante, hubiera estado en la ventana exacta del cron de las 12:00

    await createEventoAt(admin, eventoAt, [
      { user: user._id, status: "confirmed" },
    ]);

    const result = await runOnce({ now });
    expect(result.notifsCreated).toBe(1);
  });

  it("B5 — evento con reminderSentAt no se re-notifica (idempotente via flag, no via window)", async () => {
    const admin = await createUser({ isAdmin: true });
    const user = await createUser();
    const now = new Date("2027-06-12T12:00:00Z");
    const inWindow = new Date("2027-06-13T13:00:00Z");

    const evento = await createEventoAt(admin, inWindow, [
      { user: user._id, status: "confirmed" },
    ]);

    // Primera corrida: notifica + marca reminderSentAt
    let result = await runOnce({ now });
    expect(result.scanned).toBe(1);
    expect(result.notifsCreated).toBe(1);

    const refreshed = await Evento.findById(evento._id);
    expect(refreshed.reminderSentAt).toBeTruthy();

    // Segunda corrida (incluso si la primera notif fue borrada, no debería
    // re-notificar porque reminderSentAt ya está seteado).
    await Notification.deleteMany({ type: "evento_reminder" });
    result = await runOnce({ now });
    expect(result.scanned).toBe(0);
    expect(result.notifsCreated).toBe(0);
  });

  it("B5 — evento sin confirmed registrants igual queda marcado (no se reintenta)", async () => {
    const admin = await createUser({ isAdmin: true });
    const user = await createUser();
    const now = new Date("2027-06-12T12:00:00Z");
    const inWindow = new Date("2027-06-13T13:00:00Z");

    const evento = await createEventoAt(admin, inWindow, [
      { user: user._id, status: "pending" },
    ]);

    const result = await runOnce({ now });
    expect(result.notifsCreated).toBe(0);

    // Igual queda marcado — ya lo chequeamos y no hay a quién notificar.
    const refreshed = await Evento.findById(evento._id);
    expect(refreshed.reminderSentAt).toBeTruthy();
  });

  it("skips draft and cancelled events", async () => {
    const admin = await createUser({ isAdmin: true });
    const user = await createUser();
    const now = new Date("2027-06-12T12:00:00Z");
    const inWindow = new Date("2027-06-13T13:00:00Z");

    await createEventoAt(
      admin,
      inWindow,
      [{ user: user._id, status: "confirmed" }],
      { status: "draft" },
    );
    await createEventoAt(
      admin,
      inWindow,
      [{ user: user._id, status: "confirmed" }],
      { status: "cancelled" },
    );

    const result = await runOnce({ now });
    expect(result.scanned).toBe(0);
    expect(result.notifsCreated).toBe(0);
  });

  it("is idempotent — running twice does NOT create duplicate notifs", async () => {
    const admin = await createUser({ isAdmin: true });
    const user = await createUser();
    const now = new Date("2027-06-12T12:00:00Z");
    const inWindow = new Date("2027-06-13T13:00:00Z");

    await createEventoAt(admin, inWindow, [
      { user: user._id, status: "confirmed" },
    ]);

    await runOnce({ now });
    await runOnce({ now });

    const notifs = await Notification.find({
      recipient: user._id,
      type: "evento_reminder",
    });
    // Upsert por (recipient, type, eventoId) — solo 1 doc, NO se duplica.
    expect(notifs.length).toBe(1);
    // No-aggregating → count siempre 1, no incrementa.
    expect(notifs[0].count).toBe(1);
  });

  it("F6 — user con eventoReminderHours=0 NO recibe reminder 24h (opt-out)", async () => {
    const admin = await createUser({ isAdmin: true });
    const optedOut = await createUser({ eventoReminderHours: 0 });
    const wantsIt = await createUser({ eventoReminderHours: 24 });
    const now = new Date("2027-06-12T12:00:00Z");
    const inWindow = new Date("2027-06-13T13:00:00Z");

    await createEventoAt(admin, inWindow, [
      { user: optedOut._id, status: "confirmed" },
      { user: wantsIt._id, status: "confirmed" },
    ]);

    const result = await runOnce({ now });
    expect(result.notifsCreated).toBe(1);

    const optedNotifs = await Notification.find({
      recipient: optedOut._id,
      type: "evento_reminder",
    });
    const wantedNotifs = await Notification.find({
      recipient: wantsIt._id,
      type: "evento_reminder",
    });
    expect(optedNotifs.length).toBe(0);
    expect(wantedNotifs.length).toBe(1);
  });

  it("F6 — user con eventoReminderHours=2 recibe el reminder en la ventana 2h, NO en la 24h", async () => {
    const admin = await createUser({ isAdmin: true });
    const user = await createUser({ eventoReminderHours: 2 });
    const now = new Date("2027-06-12T12:00:00Z");
    const in24h = new Date("2027-06-13T13:00:00Z"); // 25h
    const in2h = new Date("2027-06-12T14:00:00Z"); // 2h

    // Evento a 24h con user.preference=2h → NO notifica todavía
    await createEventoAt(admin, in24h, [
      { user: user._id, status: "confirmed" },
    ]);
    let result = await runOnce({ now });
    expect(result.notifsCreated).toBe(0);

    // Evento a 2h con user.preference=2h → notifica ahora
    await createEventoAt(admin, in2h, [
      { user: user._id, status: "confirmed" },
    ]);
    result = await runOnce({ now });
    expect(result.notifsCreated).toBe(1);
  });

  it("F6 — user 24h y otro 2h en mismo evento: solo el 24h recibe en la ventana 24h", async () => {
    const admin = await createUser({ isAdmin: true });
    const a = await createUser({ eventoReminderHours: 24 });
    const b = await createUser({ eventoReminderHours: 2 });
    const now = new Date("2027-06-12T12:00:00Z");
    const in24h = new Date("2027-06-13T13:00:00Z");

    await createEventoAt(admin, in24h, [
      { user: a._id, status: "confirmed" },
      { user: b._id, status: "confirmed" },
    ]);

    const result = await runOnce({ now });
    expect(result.notifsCreated).toBe(1);
    const aNotifs = await Notification.find({
      recipient: a._id,
      type: "evento_reminder",
    });
    const bNotifs = await Notification.find({
      recipient: b._id,
      type: "evento_reminder",
    });
    expect(aNotifs.length).toBe(1);
    expect(bNotifs.length).toBe(0);
  });

  it('includes "closed" status events too (not just "open")', async () => {
    const admin = await createUser({ isAdmin: true });
    const user = await createUser();
    const now = new Date("2027-06-12T12:00:00Z");
    const inWindow = new Date("2027-06-13T13:00:00Z");

    await createEventoAt(
      admin,
      inWindow,
      [{ user: user._id, status: "confirmed" }],
      { status: "closed" },
    );

    const result = await runOnce({ now });
    expect(result.notifsCreated).toBe(1);
  });
});
