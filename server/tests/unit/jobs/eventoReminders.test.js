const { runOnce } = require('../../../jobs/eventoReminders');
const Evento = require('../../../models/Evento');
const Notification = require('../../../models/Notification');
const { createUser } = require('../../helpers/auth');

// Estos tests corren contra el Mongo in-memory normal del setup global.
// Antes de cada test reseteamos via el afterEach del setup.

describe('eventoReminders.runOnce', () => {
  // Helper: crear un evento con fecha exacta y registrations dadas.
  async function createEventoAt(host, eventDate, regs = [], overrides = {}) {
    return Evento.create({
      title: 'Test',
      eventDate,
      author: host._id,
      status: 'open',
      registrations: regs,
      location: { texto: 'X', lat: null, lng: null, displayName: '' },
      ...overrides,
    });
  }

  it('notifies confirmed registrants of events 24h ahead', async () => {
    const admin = await createUser({ isAdmin: true });
    const userA = await createUser();
    const userB = await createUser();
    const now = new Date('2027-06-12T12:00:00Z');
    const inWindow = new Date('2027-06-13T13:00:00Z'); // 25h ahead — dentro de la ventana

    await createEventoAt(admin, inWindow, [
      { user: userA._id, status: 'confirmed' },
      { user: userB._id, status: 'confirmed' },
    ]);

    const result = await runOnce({ now });
    expect(result.scanned).toBe(1);
    expect(result.notifsCreated).toBe(2);

    const notifsA = await Notification.find({ recipient: userA._id, type: 'evento_reminder' });
    expect(notifsA.length).toBe(1);
    expect(notifsA[0].eventoTitle).toBe('Test');
  });

  it('does NOT notify pending or rejected registrations', async () => {
    const admin = await createUser({ isAdmin: true });
    const userA = await createUser();
    const userB = await createUser();
    const now = new Date('2027-06-12T12:00:00Z');
    const inWindow = new Date('2027-06-13T13:00:00Z');

    await createEventoAt(admin, inWindow, [
      { user: userA._id, status: 'pending' },
      { user: userB._id, status: 'rejected' },
    ]);

    const result = await runOnce({ now });
    expect(result.notifsCreated).toBe(0);

    const allNotifs = await Notification.find({ type: 'evento_reminder' });
    expect(allNotifs.length).toBe(0);
  });

  it('does NOT notify events outside the [now+23h, now+25h] window', async () => {
    const admin = await createUser({ isAdmin: true });
    const user = await createUser();
    const now = new Date('2027-06-12T12:00:00Z');
    // Far future
    const farAway = new Date('2027-06-20T12:00:00Z');
    // Already past
    const past = new Date('2027-06-10T12:00:00Z');
    // Just outside (22h ahead)
    const tooSoon = new Date('2027-06-13T10:00:00Z');

    await createEventoAt(admin, farAway, [{ user: user._id, status: 'confirmed' }]);
    await createEventoAt(admin, past,    [{ user: user._id, status: 'confirmed' }]);
    await createEventoAt(admin, tooSoon, [{ user: user._id, status: 'confirmed' }]);

    const result = await runOnce({ now });
    expect(result.notifsCreated).toBe(0);
  });

  it('skips draft and cancelled events', async () => {
    const admin = await createUser({ isAdmin: true });
    const user = await createUser();
    const now = new Date('2027-06-12T12:00:00Z');
    const inWindow = new Date('2027-06-13T13:00:00Z');

    await createEventoAt(admin, inWindow, [{ user: user._id, status: 'confirmed' }], { status: 'draft' });
    await createEventoAt(admin, inWindow, [{ user: user._id, status: 'confirmed' }], { status: 'cancelled' });

    const result = await runOnce({ now });
    expect(result.scanned).toBe(0);
    expect(result.notifsCreated).toBe(0);
  });

  it('is idempotent — running twice does NOT create duplicate notifs', async () => {
    const admin = await createUser({ isAdmin: true });
    const user = await createUser();
    const now = new Date('2027-06-12T12:00:00Z');
    const inWindow = new Date('2027-06-13T13:00:00Z');

    await createEventoAt(admin, inWindow, [{ user: user._id, status: 'confirmed' }]);

    await runOnce({ now });
    await runOnce({ now });

    const notifs = await Notification.find({ recipient: user._id, type: 'evento_reminder' });
    // Upsert por (recipient, type, eventoId) — solo 1 doc, NO se duplica.
    expect(notifs.length).toBe(1);
    // No-aggregating → count siempre 1, no incrementa.
    expect(notifs[0].count).toBe(1);
  });

  it('includes "closed" status events too (not just "open")', async () => {
    const admin = await createUser({ isAdmin: true });
    const user = await createUser();
    const now = new Date('2027-06-12T12:00:00Z');
    const inWindow = new Date('2027-06-13T13:00:00Z');

    await createEventoAt(admin, inWindow, [{ user: user._id, status: 'confirmed' }], { status: 'closed' });

    const result = await runOnce({ now });
    expect(result.notifsCreated).toBe(1);
  });
});
