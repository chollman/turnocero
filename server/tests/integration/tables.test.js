const request = require('supertest');
const app = require('../../app');
const Table = require('../../models/Table');
const { createUser, createAuthedUser, tokenFor } = require('../helpers/auth');
const { createTable } = require('../helpers/factories');
const { loadSiteConfig, updateSiteConfig } = require('../../utils/siteConfig');
const SiteConfig = require('../../models/SiteConfig');

// Enable every section so route-level gating doesn't interfere with payload tests.
async function enableAllSections() {
  const all = {};
  for (const key of SiteConfig.SECTION_KEYS) all[key] = { enabled: true };
  await loadSiteConfig();
  await updateSiteConfig(all, null, null);
}

beforeEach(enableAllSections);

describe('POST /api/tables', () => {
  it('creates a public table with the caller as host (empty players)', async () => {
    const { user, token } = await createAuthedUser();
    const res = await request(app)
      .post('/api/tables')
      .set('Authorization', `Bearer ${token}`)
      .send({
        boardGame: 'Catán',
        date: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxPlayers: 4,
        location: 'BA',
        privacy: 'public',
      });
    expect(res.status).toBe(201);
    expect(res.body.host._id).toBe(user._id.toString());
    expect(res.body.players).toEqual([]);
    expect(res.body.status).toBe('open');
    expect(res.body.privacy).toBe('public');
  });

  it('400s on missing required fields', async () => {
    const { token } = await createAuthedUser();
    const res = await request(app).post('/api/tables').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  it('requires auth', async () => {
    const res = await request(app).post('/api/tables').send({});
    expect(res.status).toBe(401);
  });
});

describe('GET /api/tables', () => {
  it('returns public tables for anon visitors (no private)', async () => {
    const host = await createUser();
    await createTable(host, { boardGame: 'Public 1', privacy: 'public' });
    await createTable(host, { boardGame: 'Private', privacy: 'private' });
    const res = await request(app).get('/api/tables');
    expect(res.status).toBe(200);
    expect(res.body.tables.length).toBe(1);
    expect(res.body.tables[0].boardGame).toBe('Public 1');
  });

  it('returns both public and private tables for authenticated users', async () => {
    const host = await createUser();
    await createTable(host, { boardGame: 'Public', privacy: 'public' });
    await createTable(host, { boardGame: 'Private', privacy: 'private' });
    const { token } = await createAuthedUser();
    const res = await request(app)
      .get('/api/tables')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.tables.length).toBe(2);
  });

  it('excludes cancelled tables', async () => {
    const host = await createUser();
    const t = await createTable(host);
    t.status = 'cancelled';
    await t.save();
    const res = await request(app).get('/api/tables');
    expect(res.body.tables.length).toBe(0);
  });

  it('supports ?search by boardGame substring', async () => {
    const host = await createUser();
    await createTable(host, { boardGame: 'Wingspan' });
    await createTable(host, { boardGame: 'Catán' });
    const res = await request(app).get('/api/tables?search=wing');
    expect(res.body.tables.length).toBe(1);
    expect(res.body.tables[0].boardGame).toBe('Wingspan');
  });

  it('populates host with avatar (so client <Avatar> works)', async () => {
    const host = await createUser({ username: 'thehost' });
    await createTable(host);
    const res = await request(app).get('/api/tables');
    expect(res.body.tables[0].host._id).toBe(host._id.toString());
    expect(res.body.tables[0].host.avatar).toBeDefined();
  });
});

describe('POST /api/tables/:id/join', () => {
  it('public table: directly adds the user', async () => {
    const host = await createUser();
    const table = await createTable(host, { privacy: 'public', maxPlayers: 4 });
    const { user, token } = await createAuthedUser();

    const res = await request(app)
      .post(`/api/tables/${table._id}/join`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const refreshed = await Table.findById(table._id);
    expect(refreshed.players.map((p) => p.toString())).toContain(user._id.toString());
  });

  it('flips status to "full" when joining the last seat', async () => {
    const host = await createUser();
    const existing = await createUser();
    const table = await createTable(host, { privacy: 'public', maxPlayers: 2, players: [existing._id] });
    const { token } = await createAuthedUser();

    await request(app).post(`/api/tables/${table._id}/join`).set('Authorization', `Bearer ${token}`);
    const refreshed = await Table.findById(table._id);
    expect(refreshed.status).toBe('full');
  });

  it('private table: adds to pendingRequests instead of players', async () => {
    const host = await createUser();
    const table = await createTable(host, { privacy: 'private', maxPlayers: 4 });
    const { user, token } = await createAuthedUser();

    const res = await request(app)
      .post(`/api/tables/${table._id}/join`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const refreshed = await Table.findById(table._id);
    expect(refreshed.players.map((p) => p.toString())).not.toContain(user._id.toString());
    expect(refreshed.pendingRequests.map((p) => p.toString())).toContain(user._id.toString());
  });

  it('400s when the host tries to join their own table', async () => {
    const host = await createUser();
    const table = await createTable(host);
    const res = await request(app)
      .post(`/api/tables/${table._id}/join`)
      .set('Authorization', `Bearer ${tokenFor(host)}`);
    expect(res.status).toBe(400);
  });

  it('400s when joining a full table', async () => {
    const host = await createUser();
    const p1 = await createUser();
    const p2 = await createUser();
    const table = await createTable(host, { maxPlayers: 2, players: [p1._id, p2._id] });
    const { token } = await createAuthedUser();
    const res = await request(app).post(`/api/tables/${table._id}/join`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('400s when already joined', async () => {
    const host = await createUser();
    const { user, token } = await createAuthedUser();
    const table = await createTable(host, { players: [user._id] });
    const res = await request(app).post(`/api/tables/${table._id}/join`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/tables/:id/leave', () => {
  it('removes the caller from players and flips status full → open', async () => {
    const host = await createUser();
    const p1 = await createUser();
    const { user, token } = await createAuthedUser();
    const table = await createTable(host, { maxPlayers: 2, players: [p1._id, user._id] });
    expect(table.status).toBe('full');

    const res = await request(app)
      .post(`/api/tables/${table._id}/leave`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const refreshed = await Table.findById(table._id);
    expect(refreshed.players.map((p) => p.toString())).not.toContain(user._id.toString());
    expect(refreshed.status).toBe('open');
  });
});

describe('PUT /api/tables/:id (host only)', () => {
  it('host can update fields', async () => {
    const host = await createUser();
    const table = await createTable(host, { location: 'old' });
    const res = await request(app)
      .put(`/api/tables/${table._id}`)
      .set('Authorization', `Bearer ${tokenFor(host)}`)
      .send({
        date: new Date(Date.now() + 14 * 86400000).toISOString(),
        maxPlayers: 4,
        location: 'new place',
        description: 'fresh',
      });
    expect(res.status).toBe(200);
    expect(res.body.location).toBe('new place');
    expect(res.body.description).toBe('fresh');
  });

  it('non-host gets 403', async () => {
    const host = await createUser();
    const table = await createTable(host);
    const { token } = await createAuthedUser();
    const res = await request(app)
      .put(`/api/tables/${table._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: new Date().toISOString(), maxPlayers: 4 });
    expect(res.status).toBe(403);
  });

  it('400s when reducing maxPlayers below current player count', async () => {
    const host = await createUser();
    const p1 = await createUser();
    const p2 = await createUser();
    const table = await createTable(host, { maxPlayers: 4, players: [p1._id, p2._id] });
    const res = await request(app)
      .put(`/api/tables/${table._id}`)
      .set('Authorization', `Bearer ${tokenFor(host)}`)
      .send({ date: new Date().toISOString(), maxPlayers: 1 });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/tables/:id (cancel)', () => {
  it('host can cancel (sets status to "cancelled", excludes from list)', async () => {
    const host = await createUser();
    const table = await createTable(host);
    const res = await request(app)
      .delete(`/api/tables/${table._id}`)
      .set('Authorization', `Bearer ${tokenFor(host)}`);
    expect(res.status).toBe(200);

    const refreshed = await Table.findById(table._id);
    expect(refreshed.status).toBe('cancelled');

    const list = await request(app).get('/api/tables');
    expect(list.body.tables.find((t) => t._id === String(table._id))).toBeUndefined();
  });
});
