const request = require('supertest');
const app = require('../../app');
const Torneo = require('../../models/Torneo');
const TorneoMatch = require('../../models/TorneoMatch');
const { createAuthedUser, createUser, tokenFor } = require('../helpers/auth');
const { createTorneo } = require('../helpers/factories');
const { loadSiteConfig, updateSiteConfig } = require('../../utils/siteConfig');
const SiteConfig = require('../../models/SiteConfig');

beforeEach(async () => {
  const all = {};
  for (const key of SiteConfig.SECTION_KEYS) all[key] = { enabled: true };
  await loadSiteConfig();
  await updateSiteConfig(all, null, null);
});

describe('POST /api/torneos (admin only)', () => {
  it('non-admin gets 403', async () => {
    const { token } = await createAuthedUser({ isAdmin: false });
    const res = await request(app)
      .post('/api/torneos')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'x')
      .field('game', 'Catán')
      .field('format', 'league');
    expect(res.status).toBe(403);
  });

  it('admin can create a league torneo in draft', async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .post('/api/torneos')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Liga 1')
      .field('game', 'Catán')
      .field('format', 'league')
      .field('maxParticipants', 8);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('draft');
    expect(res.body.format).toBe('league');
    expect(res.body.inscriptionMode).toBe('open');
  });

  it('400s on invalid format', async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .post('/api/torneos')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'x')
      .field('game', 'Catán')
      .field('format', 'invalid');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/torneos (list)', () => {
  // NOTE: CLAUDE.md documents this endpoint as `optionalAuth` but the code
  // currently has `protect, requireAdmin`. We test the current behavior; if
  // the endpoint is reopened to public the assertion should flip to 200.
  it('currently requires admin (route is admin-only)', async () => {
    const admin = await createUser({ isAdmin: true });
    await createTorneo(admin, { title: 'Open Torneo', status: 'registration' });
    await createTorneo(admin, { title: 'Draft Torneo', status: 'draft' });

    const anonRes = await request(app).get('/api/torneos');
    expect(anonRes.status).toBe(401); // protect middleware

    const adminRes = await request(app)
      .get('/api/torneos')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);
    expect(adminRes.status).toBe(200);
    const titles = adminRes.body.torneos.map((t) => t.title).sort();
    expect(titles).toEqual(['Draft Torneo', 'Open Torneo']);
  });
});

describe('Lifecycle: league format', () => {
  let admin, adminToken;
  let p1, p2, p3, p4;

  beforeEach(async () => {
    admin = await createUser({ isAdmin: true });
    adminToken = tokenFor(admin);
    p1 = await createUser({ username: 'player1' });
    p2 = await createUser({ username: 'player2' });
    p3 = await createUser({ username: 'player3' });
    p4 = await createUser({ username: 'player4' });
  });

  it('full happy path: draft → registration → admin adds participants → in_progress (generates fixture) → records result → standings reflect', async () => {
    // 1. Create as draft (admin_only mode so we can add participants directly)
    const torneo = await createTorneo(admin, {
      format: 'league',
      status: 'draft',
      inscriptionMode: 'admin_only',
    });

    // 2. Admin adds 4 participants
    for (const p of [p1, p2, p3, p4]) {
      const res = await request(app)
        .post(`/api/torneos/${torneo._id}/participants/${p._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    }

    let refreshed = await Torneo.findById(torneo._id);
    expect(refreshed.participants.length).toBe(4);

    // 3. Advance directly to in_progress (admin_only mode allows it)
    const startRes = await request(app)
      .patch(`/api/torneos/${torneo._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'in_progress' });
    expect(startRes.status).toBe(200);

    refreshed = await Torneo.findById(torneo._id);
    expect(refreshed.status).toBe('in_progress');

    // 4. Fixture has been generated: 4 players → C(4,2) = 6 matches
    const matches = await TorneoMatch.find({ torneo: torneo._id });
    expect(matches.length).toBe(6);

    // 5. Record one match result (p1 beats p2)
    const matchP1P2 = matches.find((m) => {
      const a = String(m.playerA);
      const b = String(m.playerB);
      return (
        (a === String(p1._id) && b === String(p2._id)) ||
        (a === String(p2._id) && b === String(p1._id))
      );
    });
    expect(matchP1P2).toBeDefined();

    const resultRes = await request(app)
      .post(`/api/torneos/${torneo._id}/matches/${matchP1P2._id}/result`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ winnerId: String(p1._id) });
    expect(resultRes.status).toBe(200);

    const refreshedMatch = await TorneoMatch.findById(matchP1P2._id);
    expect(refreshedMatch.status).toBe('completed');
    expect(String(refreshedMatch.winner)).toBe(String(p1._id));

    // 6. Standings show p1 with 3 points (endpoint requires admin in current code)
    const standingsRes = await request(app)
      .get(`/api/torneos/${torneo._id}/standings`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(standingsRes.status).toBe(200);
    const standings = Array.isArray(standingsRes.body) ? standingsRes.body : standingsRes.body.standings;
    const p1Standing = standings.find((s) => String(s.user?._id || s.user) === String(p1._id));
    expect(p1Standing).toBeDefined();
    expect(p1Standing.points).toBe(3);
  });

  it('rejects status transition from draft → in_progress with no participants', async () => {
    const torneo = await createTorneo(admin, {
      format: 'league',
      status: 'draft',
      inscriptionMode: 'admin_only',
    });
    const res = await request(app)
      .patch(`/api/torneos/${torneo._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/torneos/:id', () => {
  it('admin can delete a draft', async () => {
    const admin = await createUser({ isAdmin: true });
    const torneo = await createTorneo(admin, { status: 'draft' });
    const res = await request(app)
      .delete(`/api/torneos/${torneo._id}`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`);
    expect(res.status).toBe(200);
    expect(await Torneo.findById(torneo._id)).toBeNull();
  });
});
