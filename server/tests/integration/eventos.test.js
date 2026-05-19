const request = require('supertest');
const app = require('../../app');
const Evento = require('../../models/Evento');
const { createUser, createAuthedUser, tokenFor } = require('../helpers/auth');
const { createEvento } = require('../helpers/factories');
const { loadSiteConfig, updateSiteConfig } = require('../../utils/siteConfig');

async function ensureEventosSectionOn() {
  await loadSiteConfig();
  await updateSiteConfig({ eventos: { enabled: true } }, null, null);
}

beforeEach(async () => {
  await ensureEventosSectionOn();
});

describe('GET /api/eventos', () => {
  it('returns paginated open/closed eventos publicly', async () => {
    const admin = await createUser({ isAdmin: true });
    await createEvento(admin, { title: 'Open A', status: 'open' });
    await createEvento(admin, { title: 'Closed B', status: 'closed' });
    await createEvento(admin, { title: 'Draft C', status: 'draft' });

    const res = await request(app).get('/api/eventos');
    expect(res.status).toBe(200);
    expect(res.body.eventos.length).toBe(2);
    expect(res.body.eventos.map((e) => e.title).sort()).toEqual(['Closed B', 'Open A']);
  });

  it('admins can see drafts when filtered explicitly', async () => {
    const admin = await createUser({ isAdmin: true });
    await createEvento(admin, { title: 'Draft', status: 'draft' });

    const res = await request(app)
      .get('/api/eventos?status=draft')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);
    expect(res.status).toBe(200);
    expect(res.body.eventos.length).toBe(1);
    expect(res.body.eventos[0].status).toBe('draft');
  });

  it('non-admins cannot see drafts even via status filter', async () => {
    const admin = await createUser({ isAdmin: true });
    await createEvento(admin, { title: 'Draft', status: 'draft' });

    const res = await request(app).get('/api/eventos?status=draft');
    expect(res.body.eventos.length).toBe(0);
  });
});

describe('GET /api/eventos/:id (public detail)', () => {
  it('exposes the author populated with avatar', async () => {
    const admin = await createUser({ isAdmin: true, username: 'orga' });
    const evento = await createEvento(admin);

    const res = await request(app).get(`/api/eventos/${evento._id}`);
    expect(res.status).toBe(200);
    expect(res.body.author.username).toBe('orga');
    expect(res.body.author.avatar).toBeDefined();
  });

  it('returns confirmedRegistrations with { _id, username, displayName, avatar } per user (regression for the ghost-avatar bug)', async () => {
    const admin = await createUser({ isAdmin: true });
    const p1 = await createUser({ username: 'player1' });
    const p2 = await createUser({ username: 'player2', displayName: 'Player Two' });

    const evento = await createEvento(admin, {
      registrations: [
        { user: p1._id, status: 'confirmed', submittedAt: new Date() },
        { user: p2._id, status: 'confirmed', submittedAt: new Date() },
        { user: admin._id, status: 'pending', submittedAt: new Date() },
      ],
    });

    const res = await request(app).get(`/api/eventos/${evento._id}`);
    expect(res.status).toBe(200);
    expect(res.body.confirmedRegistrations.length).toBe(2);
    const usernames = res.body.confirmedRegistrations.map((r) => r.user.username).sort();
    expect(usernames).toEqual(['player1', 'player2']);

    // Every confirmed user MUST expose _id and avatar so client-side <Avatar>
    // works (without _id, getUserDisplay flags as deleted → ghost icon).
    for (const r of res.body.confirmedRegistrations) {
      expect(r.user._id).toBeTruthy();
      expect(r.user.avatar).toBeDefined();
    }
  });

  it('omits the bulky registrations array from the public payload', async () => {
    const admin = await createUser({ isAdmin: true });
    const evento = await createEvento(admin);
    const res = await request(app).get(`/api/eventos/${evento._id}`);
    expect(res.body.registrations).toBeUndefined();
  });

  it('returns the caller\'s own registration via userRegistration', async () => {
    const admin = await createUser({ isAdmin: true });
    const { user, token } = await createAuthedUser();
    const evento = await createEvento(admin, {
      registrations: [{ user: user._id, status: 'pending', submittedAt: new Date() }],
    });

    const res = await request(app)
      .get(`/api/eventos/${evento._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userRegistration).toMatchObject({ status: 'pending' });
  });

  it('hides drafts from non-admins (404)', async () => {
    const admin = await createUser({ isAdmin: true });
    const evento = await createEvento(admin, { status: 'draft' });
    const res = await request(app).get(`/api/eventos/${evento._id}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/eventos (admin only)', () => {
  it('non-admin gets 403', async () => {
    const { token } = await createAuthedUser({ isAdmin: false });
    const res = await request(app)
      .post('/api/eventos')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'New');
    expect(res.status).toBe(403);
  });

  it('admin can create with no image', async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .post('/api/eventos')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Sin imagen')
      .field('fee', 0)
      .field('location', 'Buenos Aires');

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Sin imagen');
    expect(res.body.author.username).toBeDefined();
  });
});

describe('PATCH /api/eventos/:id/inscripciones/:userId/confirmar', () => {
  it('flips a registration from pending to confirmed', async () => {
    const admin = await createUser({ isAdmin: true });
    const user = await createUser();
    const evento = await createEvento(admin, {
      registrations: [{ user: user._id, status: 'pending', submittedAt: new Date() }],
    });

    const res = await request(app)
      .patch(`/api/eventos/${evento._id}/inscripciones/${user._id}/confirmar`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send({ adminNotes: 'OK' });

    expect(res.status).toBe(200);
    const refreshed = await Evento.findById(evento._id);
    const reg = refreshed.registrations.find((r) => r.user.equals(user._id));
    expect(reg.status).toBe('confirmed');
    expect(reg.adminNotes).toBe('OK');
  });

  it('non-admin gets 403', async () => {
    const admin = await createUser({ isAdmin: true });
    const { user, token } = await createAuthedUser();
    const evento = await createEvento(admin, {
      registrations: [{ user: user._id, status: 'pending', submittedAt: new Date() }],
    });

    const res = await request(app)
      .patch(`/api/eventos/${evento._id}/inscripciones/${user._id}/confirmar`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('section gating', () => {
  it('blocks every route when eventos section is disabled (non-admin)', async () => {
    await updateSiteConfig({ eventos: { enabled: false } }, null, null);
    const res = await request(app).get('/api/eventos');
    expect(res.status).toBe(403);
  });
});
