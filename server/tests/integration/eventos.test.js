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

  it('enriches each evento with registrationCount (regression: progressbar did not update on inscription)', async () => {
    const admin = await createUser({ isAdmin: true });
    const p1 = await createUser({ username: 'player1' });
    const p2 = await createUser({ username: 'player2' });
    const p3 = await createUser({ username: 'player3' });

    await createEvento(admin, {
      title: 'Evento con inscripciones',
      status: 'open',
      maxParticipants: 10,
      registrations: [
        { user: p1._id, status: 'pending', submittedAt: new Date() },
        { user: p2._id, status: 'pending', submittedAt: new Date() },
        { user: p3._id, status: 'confirmed', submittedAt: new Date() },
      ],
    });

    const res = await request(app).get('/api/eventos');
    expect(res.status).toBe(200);
    const evento = res.body.eventos.find((e) => e.title === 'Evento con inscripciones');
    expect(evento.registrationCount).toEqual({ total: 3, pending: 2, confirmed: 1 });
    expect(evento.registrations).toBeUndefined(); // not leaked to clients
  });

  it('includes the current user\'s userRegistration in each evento (logged-in only)', async () => {
    const admin = await createUser({ isAdmin: true });
    const me = await createUser({ username: 'me_user' });
    const other = await createUser({ username: 'other_user' });

    await createEvento(admin, {
      title: 'Evento con mi inscripción',
      status: 'open',
      registrations: [
        { user: me._id, status: 'pending', submittedAt: new Date() },
        { user: other._id, status: 'confirmed', submittedAt: new Date() },
      ],
    });

    const res = await request(app)
      .get('/api/eventos')
      .set('Authorization', `Bearer ${tokenFor(me)}`);
    expect(res.status).toBe(200);
    const evento = res.body.eventos[0];
    expect(evento.userRegistration).toBeTruthy();
    expect(evento.userRegistration.status).toBe('pending');
  });

  it('omits userRegistration for unauthenticated requests', async () => {
    const admin = await createUser({ isAdmin: true });
    await createEvento(admin, { title: 'Anon list', status: 'open' });

    const res = await request(app).get('/api/eventos');
    expect(res.body.eventos[0].userRegistration).toBeNull();
  });

  it('auto-closes open events whose eventDate is in the past', async () => {
    const admin = await createUser({ isAdmin: true });
    const pastDate = new Date(Date.now() - 7 * 86400000);
    const futureDate = new Date(Date.now() + 7 * 86400000);

    const stale = await createEvento(admin, {
      title:     'Pasado abierto',
      status:    'open',
      eventDate: pastDate,
    });
    const fresh = await createEvento(admin, {
      title:     'Futuro abierto',
      status:    'open',
      eventDate: futureDate,
    });
    const draftPast = await createEvento(admin, {
      title:     'Draft pasado',
      status:    'draft',
      eventDate: pastDate,
    });

    // List request triggers the sweep
    await request(app).get('/api/eventos');

    // Re-fetch from DB to confirm persistence
    const staleAfter     = await Evento.findById(stale._id);
    const freshAfter     = await Evento.findById(fresh._id);
    const draftPastAfter = await Evento.findById(draftPast._id);

    expect(staleAfter.status).toBe('closed');     // ← auto-closed
    expect(freshAfter.status).toBe('open');       // ← future event untouched
    expect(draftPastAfter.status).toBe('draft');  // ← drafts no auto-close
  });

  it('past open event no longer appears under ?status=open, only under ?status=closed', async () => {
    const admin = await createUser({ isAdmin: true });
    await createEvento(admin, {
      title:     'Ayer abierto',
      status:    'open',
      eventDate: new Date(Date.now() - 86400000),
    });

    // Trigger sweep
    await request(app).get('/api/eventos');

    const openList = await request(app).get('/api/eventos?status=open');
    expect(openList.body.eventos.map((e) => e.title)).not.toContain('Ayer abierto');

    const closedList = await request(app).get('/api/eventos?status=closed');
    expect(closedList.body.eventos.map((e) => e.title)).toContain('Ayer abierto');

    // "Todos" (sin filtro, admin) tampoco lo pierde
    const adminAll = await request(app)
      .get('/api/eventos')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);
    expect(adminAll.body.eventos.map((e) => e.title)).toContain('Ayer abierto');
  });
});

describe('PUT /api/eventos/:id', () => {
  it('partial update preserves untouched fields (regression: cancel was clobbering eventDate, description, etc.)', async () => {
    const admin = await createUser({ isAdmin: true });
    const evento = await createEvento(admin, {
      title:           'Evento original',
      description:     'Una descripción importante',
      conditions:      'Condiciones puntuales',
      location:        'Bar La Torre',
      eventDate:       new Date('2026-09-01T20:00:00Z'),
      fee:             3500,
      maxParticipants: 24,
      transferDetails: 'Alias: turnocero',
      status:          'open',
    });

    // Partial cancel: only send status
    const res = await request(app)
      .put(`/api/eventos/${evento._id}`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .field('status', 'cancelled');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    expect(res.body.description).toBe('Una descripción importante');
    expect(res.body.conditions).toBe('Condiciones puntuales');
    expect(res.body.location).toBe('Bar La Torre');
    expect(res.body.eventDate).toBeTruthy();
    expect(res.body.fee).toBe(3500);
    expect(res.body.maxParticipants).toBe(24);
    expect(res.body.transferDetails).toBe('Alias: turnocero');

    // And the Cancelados admin filter now returns it
    const list = await request(app)
      .get('/api/eventos?status=cancelled')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);
    expect(list.body.eventos.map((e) => e.title)).toContain('Evento original');
  });

  it('full form update can still clear individual fields with empty strings', async () => {
    const admin = await createUser({ isAdmin: true });
    const evento = await createEvento(admin, {
      title:       'Con descripción',
      description: 'va a desaparecer',
      location:    'va a desaparecer',
      status:      'open',
    });

    const res = await request(app)
      .put(`/api/eventos/${evento._id}`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .field('title', 'Renombrado')
      .field('description', '')
      .field('location', '');

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Renombrado');
    expect(res.body.description).toBeFalsy();
    expect(res.body.location).toBeFalsy();
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

  it('hides cancelled events from non-admins (404)', async () => {
    const admin = await createUser({ isAdmin: true });
    const evento = await createEvento(admin, { status: 'cancelled' });

    // Anonymous: 404
    const anon = await request(app).get(`/api/eventos/${evento._id}`);
    expect(anon.status).toBe(404);

    // Regular logged-in user: also 404
    const { token } = await createAuthedUser({ isAdmin: false });
    const user = await request(app)
      .get(`/api/eventos/${evento._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(user.status).toBe(404);

    // Admin: still sees it
    const adminRes = await request(app)
      .get(`/api/eventos/${evento._id}`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.status).toBe('cancelled');
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
      .field('location', 'Buenos Aires')
      .field('eventDate', new Date(Date.now() + 7 * 86400000).toISOString());

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Sin imagen');
    expect(res.body.author.username).toBeDefined();
  });

  it('rejects creation without eventDate (400)', async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .post('/api/eventos')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Sin fecha');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/fecha/i);
  });

  it('rejects creation with an invalid eventDate (400)', async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .post('/api/eventos')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Fecha mala')
      .field('eventDate', 'no-es-una-fecha');
    expect(res.status).toBe(400);
  });

  it('rejects creation without title (400)', async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .post('/api/eventos')
      .set('Authorization', `Bearer ${token}`)
      .field('eventDate', new Date(Date.now() + 86400000).toISOString());
    expect(res.status).toBe(400);
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
