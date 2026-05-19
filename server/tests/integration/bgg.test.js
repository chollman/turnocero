const request = require('supertest');
const app = require('../../app');
const BggGame = require('../../models/BggGame');
const bggRouter = require('../../routes/bgg');

// ── Fixtures ─────────────────────────────────────────────────────────
function thingXml(games) {
  const items = games.map((g) => `
    <item type="boardgame" id="${g.id}">
      <thumbnail>${g.thumbnail || ''}</thumbnail>
      <image>${g.image || ''}</image>
      <name type="primary" sortindex="1" value="${g.name}"/>
      <yearpublished value="${g.year || 0}"/>
      <minplayers value="${g.minPlayers || 0}"/>
      <maxplayers value="${g.maxPlayers || 0}"/>
    </item>
  `).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><items>${items}</items>`;
}

function emptyThingXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><items></items>`;
}

function searchXml(games) {
  const items = games.map((g) => `
    <item type="boardgame" id="${g.id}">
      <name type="primary" value="${g.name}"/>
      <yearpublished value="${g.year || 0}"/>
    </item>
  `).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><items total="${games.length}">${items}</items>`;
}

function playsXml(plays, total) {
  const playsContent = plays.map((p) => `
    <play id="${p.id}" date="${p.date}" quantity="1" length="60" incomplete="0" nowinstats="0" location="">
      <item name="${p.gameName}" objecttype="thing" objectid="${p.gameId}"/>
      <players><player username="" name="Solo" startposition="" color="" score="" rating="0" new="0" win="1"/></players>
    </play>
  `).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><plays username="user" userid="1" total="${total ?? plays.length}" page="1">${playsContent}</plays>`;
}

function ok(body) {
  return { ok: true, status: 200, text: async () => body };
}

// ── Suite ────────────────────────────────────────────────────────────
describe('BGG persistent cache (memoria → Mongo → BGG)', () => {
  let fetchSpy;

  beforeEach(() => {
    bggRouter.__resetCache();
    fetchSpy = vi.fn();
    global.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
  });

  // ── GET /api/bgg/game/:id ─────────────────────────────────────────
  describe('GET /api/bgg/game/:id', () => {
    it('cold path: empty Mongo → calls BGG once and persists the game', async () => {
      fetchSpy.mockResolvedValueOnce(ok(thingXml([{
        id: 1001, name: 'Catan', thumbnail: 't1', image: 'i1', year: 1995, minPlayers: 3, maxPlayers: 4,
      }])));

      const res = await request(app).get('/api/bgg/game/1001');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 1001, name: 'Catan', thumbnail: 't1', image: 'i1', year: 1995, minPlayers: 3, maxPlayers: 4,
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const persisted = await BggGame.findOne({ gameId: 1001 }).lean();
      expect(persisted).toBeTruthy();
      expect(persisted.name).toBe('Catan');
      expect(persisted.thumbnail).toBe('t1');
    });

    it('warm path: game already in Mongo → does NOT call BGG', async () => {
      await BggGame.create({
        gameId: 1002, name: 'Cached', thumbnail: 't2', image: 'i2',
        yearPublished: 2000, minPlayers: 2, maxPlayers: 5,
      });

      const res = await request(app).get('/api/bgg/game/1002');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 1002, name: 'Cached', thumbnail: 't2' });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('404 when BGG returns no item for an unknown id', async () => {
      fetchSpy.mockResolvedValueOnce(ok(emptyThingXml()));
      const res = await request(app).get('/api/bgg/game/9999');
      expect(res.status).toBe(404);
    });

    it('502 when BGG fails with a non-404 error', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 500, text: async () => '' });
      const res = await request(app).get('/api/bgg/game/1003');
      expect(res.status).toBe(502);
    });

    it('400 on invalid id', async () => {
      const res = await request(app).get('/api/bgg/game/abc');
      expect(res.status).toBe(400);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // ── GET /api/bgg/partidas/:user — enrichment ─────────────────────
  describe('GET /api/bgg/partidas/:bggUsername', () => {
    it('cold: fetches /plays + batch /thing, then persists every game', async () => {
      fetchSpy
        .mockResolvedValueOnce(ok(playsXml([
          { id: '101', date: '2026-01-01', gameName: 'Catan', gameId: 2001 },
          { id: '102', date: '2026-01-02', gameName: 'Wingspan', gameId: 2002 },
        ])))
        .mockResolvedValueOnce(ok(thingXml([
          { id: 2001, name: 'Catan', thumbnail: 'catan.jpg' },
          { id: 2002, name: 'Wingspan', thumbnail: 'wing.jpg' },
        ])));

      const res = await request(app).get('/api/bgg/partidas/someuser');
      expect(res.status).toBe(200);
      expect(res.body.plays).toHaveLength(2);
      expect(res.body.plays[0].gameThumbnail).toBe('catan.jpg');
      expect(res.body.plays[1].gameThumbnail).toBe('wing.jpg');

      // Both games were persisted.
      const count = await BggGame.countDocuments({ gameId: { $in: [2001, 2002] } });
      expect(count).toBe(2);
      expect(fetchSpy).toHaveBeenCalledTimes(2); // 1 plays + 1 batch thing
    });

    it('mixed: some games already cached in Mongo → BGG /thing only requested for the missing ones', async () => {
      // Pre-populate one of the two games in Mongo.
      await BggGame.create({ gameId: 3001, name: 'Already', thumbnail: 'already.jpg' });

      fetchSpy
        .mockResolvedValueOnce(ok(playsXml([
          { id: '201', date: '2026-02-01', gameName: 'Already', gameId: 3001 },
          { id: '202', date: '2026-02-02', gameName: 'NewGame',  gameId: 3002 },
        ])))
        .mockResolvedValueOnce(ok(thingXml([
          { id: 3002, name: 'NewGame', thumbnail: 'new.jpg' },
        ])));

      const res = await request(app).get('/api/bgg/partidas/mixeduser');
      expect(res.status).toBe(200);
      expect(res.body.plays[0].gameThumbnail).toBe('already.jpg');
      expect(res.body.plays[1].gameThumbnail).toBe('new.jpg');

      // The /thing call URL should only contain the missing id (3002), not 3001.
      const thingCallUrl = fetchSpy.mock.calls[1][0];
      expect(thingCallUrl).toContain('id=3002');
      expect(thingCallUrl).not.toContain('3001');
    });

    it('warm: all games already in Mongo → BGG /thing is NOT called at all', async () => {
      await BggGame.create({ gameId: 4001, name: 'W1', thumbnail: 'w1.jpg' });
      await BggGame.create({ gameId: 4002, name: 'W2', thumbnail: 'w2.jpg' });

      fetchSpy.mockResolvedValueOnce(ok(playsXml([
        { id: '301', date: '2026-03-01', gameName: 'W1', gameId: 4001 },
        { id: '302', date: '2026-03-02', gameName: 'W2', gameId: 4002 },
      ])));

      const res = await request(app).get('/api/bgg/partidas/warmuser');
      expect(res.status).toBe(200);
      expect(res.body.plays[0].gameThumbnail).toBe('w1.jpg');
      expect(res.body.plays[1].gameThumbnail).toBe('w2.jpg');

      // Only ONE call to fetch — the /plays endpoint. NOT a second call to /thing.
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toContain('/plays');
    });

    it('shared across users: user A populates the cache, user B reuses it', async () => {
      // User A — cold path, populates Mongo.
      fetchSpy
        .mockResolvedValueOnce(ok(playsXml([
          { id: '401', date: '2026-04-01', gameName: 'Shared', gameId: 5001 },
        ])))
        .mockResolvedValueOnce(ok(thingXml([
          { id: 5001, name: 'Shared', thumbnail: 'shared.jpg' },
        ])));
      await request(app).get('/api/bgg/partidas/userA');
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Reset only the in-memory L1 cache (simulating a server restart),
      // and the /plays call for user B should still NOT trigger a /thing
      // call because Mongo already has the game.
      bggRouter.__resetCache();
      fetchSpy.mockClear();
      fetchSpy.mockResolvedValueOnce(ok(playsXml([
        { id: '402', date: '2026-04-02', gameName: 'Shared', gameId: 5001 },
      ])));

      const res = await request(app).get('/api/bgg/partidas/userB');
      expect(res.status).toBe(200);
      expect(res.body.plays[0].gameThumbnail).toBe('shared.jpg');
      expect(fetchSpy).toHaveBeenCalledTimes(1); // only /plays for user B
    });
  });

  // ── ?refresh=1 bypasses the in-memory cache ──────────────────────
  describe('?refresh=1 query', () => {
    it('coleccion: serves cached on plain GET, hits BGG when refresh=1', async () => {
      const collectionXml = `<?xml version="1.0"?><items><item objectid="9001"><name>X</name></item></items>`;
      // First GET — cold, calls BGG
      fetchSpy.mockResolvedValueOnce(ok(collectionXml));
      await request(app).get('/api/bgg/coleccion/refreshtest');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second GET without refresh — cache hit, BGG NOT called
      await request(app).get('/api/bgg/coleccion/refreshtest');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Third GET with ?refresh=1 — bypasses cache, hits BGG again
      fetchSpy.mockResolvedValueOnce(ok(collectionXml));
      await request(app).get('/api/bgg/coleccion/refreshtest?refresh=1');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('partidas: serves cached on plain GET, hits BGG when refresh=1', async () => {
      // First GET — cold, calls /plays (no games in plays → no /thing call)
      fetchSpy.mockResolvedValueOnce(ok(playsXml([])));
      await request(app).get('/api/bgg/partidas/refreshtest');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second GET without refresh — cache hit
      await request(app).get('/api/bgg/partidas/refreshtest');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Third GET with ?refresh=1 — calls BGG again
      fetchSpy.mockResolvedValueOnce(ok(playsXml([])));
      await request(app).get('/api/bgg/partidas/refreshtest?refresh=1');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ── GET /api/bgg/search ──────────────────────────────────────────
  describe('GET /api/bgg/search', () => {
    it('cold: enriches results with thumbnails from BGG and persists them', async () => {
      fetchSpy
        .mockResolvedValueOnce(ok(searchXml([
          { id: 6001, name: 'Foo', year: 2020 },
          { id: 6002, name: 'Bar', year: 2021 },
        ])))
        .mockResolvedValueOnce(ok(thingXml([
          { id: 6001, name: 'Foo', thumbnail: 'foo.jpg' },
          { id: 6002, name: 'Bar', thumbnail: 'bar.jpg' },
        ])));

      const res = await request(app).get('/api/bgg/search?q=foobar');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 6001, thumbnail: 'foo.jpg' }),
        expect.objectContaining({ id: 6002, thumbnail: 'bar.jpg' }),
      ]));
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(await BggGame.countDocuments({ gameId: { $in: [6001, 6002] } })).toBe(2);
    });

    it('warm: when both games are already in Mongo, BGG /thing is not called for thumbnails', async () => {
      await BggGame.create({ gameId: 7001, name: 'X', thumbnail: 'x.jpg' });
      await BggGame.create({ gameId: 7002, name: 'Y', thumbnail: 'y.jpg' });

      fetchSpy.mockResolvedValueOnce(ok(searchXml([
        { id: 7001, name: 'X', year: 2018 },
        { id: 7002, name: 'Y', year: 2019 },
      ])));

      const res = await request(app).get('/api/bgg/search?q=warmsearch');
      expect(res.status).toBe(200);
      expect(res.body.find((g) => g.id === 7001).thumbnail).toBe('x.jpg');
      expect(res.body.find((g) => g.id === 7002).thumbnail).toBe('y.jpg');
      // Only the search call itself — no second call for /thing.
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toContain('/search');
    });
  });
});
