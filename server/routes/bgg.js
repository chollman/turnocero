const express = require('express');
const router = express.Router();
const { XMLParser } = require('fast-xml-parser');
const { protect } = require('../middleware/auth');
const { requireSection } = require('../middleware/sectionGate');
const { getSessionCookie, clearSession } = require('../utils/bggAuth');
const User = require('../models/User');
const BggGame = require('../models/BggGame');

router.use(requireSection('bgwatch'));

// Persistent cache pattern: memoria → Mongo → BGG.
// `BggGame` stores the immutable bits (name, image, thumbnail, year, players)
// once per gameId and is shared across all users. The in-memory `cache` Map
// below is kept as an L1 layer to avoid repeated Mongo round-trips within a
// short window. For future entities (collection, plays) follow the same
// pattern: add a model + a `resolveXxx` helper.
const BGG_API = 'https://boardgamegeek.com/xmlapi2';
const BGG_GEEKPLAY = 'https://boardgamegeek.com/geekplay.php';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos (el botón "Actualizar" del cliente bypassa esto con ?refresh=1)
const cache = new Map();

function getCached(key, ttl = CACHE_TTL) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) { cache.delete(key); return null; }
  return entry.data;
}

function setCached(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

function clearPartidasCache(bggUsername) {
  const prefix = `partidas:${String(bggUsername).toLowerCase()}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

// Clears everything in the in-memory cache that's specific to one BGG
// username: their plays (all pages/filters), collection, and OG metadata.
// Called when a user reconnects their BGG account so subsequent reads come
// fresh from BGG and don't show stale state from a previous session.
function clearUserCache(bggUsername) {
  const lower = String(bggUsername).toLowerCase();
  cache.delete(`coleccion:${lower}`);
  cache.delete(`og:${lower}`);
  clearPartidasCache(bggUsername);
}

async function fetchBgg(url) {
  const headers = { 'User-Agent': 'Turnocero/1.0' };
  if (process.env.BGG_API_KEY) headers.Authorization = `Bearer ${process.env.BGG_API_KEY}`;

  let res = await fetch(url, { headers });

  if (res.status === 202) {
    // BGG encola el pedido — reintentar una vez después de 2s
    await new Promise((r) => { setTimeout(r, 2000); });
    res = await fetch(url, { headers });
  }

  if (!res.ok) {
    const err = new Error(`BGG responded with ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.text();
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

const GAME_CACHE_TTL = 30 * 60 * 1000; // 30 minutos

// ── Game resolution helpers (memoria → Mongo → BGG) ──────────────────
function parseGameItem(item) {
  const nameRaw = item.name;
  const nameArr = Array.isArray(nameRaw) ? nameRaw : [nameRaw];
  const primary = nameArr.find((n) => n['@_type'] === 'primary') || nameArr[0];
  const thumb = typeof item.thumbnail === 'string'
    ? item.thumbnail
    : (item.thumbnail?.['#text'] || null);
  const img = typeof item.image === 'string'
    ? item.image
    : (item.image?.['#text'] || null);
  return {
    id: Number(item['@_id']),
    name: primary?.['@_value'] || '',
    thumbnail: thumb || null,
    image: img || null,
    year: item.yearpublished?.['@_value'] ? Number(item.yearpublished['@_value']) : null,
    minPlayers: item.minplayers?.['@_value'] ? Number(item.minplayers['@_value']) : null,
    maxPlayers: item.maxplayers?.['@_value'] ? Number(item.maxplayers['@_value']) : null,
  };
}

function gameDocToObject(doc) {
  return {
    id: doc.gameId,
    name: doc.name,
    thumbnail: doc.thumbnail,
    image: doc.image,
    year: doc.yearPublished,
    minPlayers: doc.minPlayers,
    maxPlayers: doc.maxPlayers,
  };
}

async function persistGame(game) {
  await BggGame.updateOne(
    { gameId: game.id },
    {
      $set: {
        name: game.name,
        thumbnail: game.thumbnail,
        image: game.image,
        yearPublished: game.year,
        minPlayers: game.minPlayers,
        maxPlayers: game.maxPlayers,
        lastFetchedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

async function resolveGame(gameId) {
  const id = Number(gameId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const cached = getCached(`game:${id}`, GAME_CACHE_TTL);
  if (cached) return cached;

  const doc = await BggGame.findOne({ gameId: id }).lean();
  if (doc) {
    const game = gameDocToObject(doc);
    setCached(`game:${id}`, game);
    return game;
  }

  const xml = await fetchBgg(`${BGG_API}/thing?id=${id}&type=boardgame`);
  const parsed = parser.parse(xml);
  const item = parsed?.items?.item;
  if (!item) return null;
  const game = parseGameItem(item);
  await persistGame(game);
  setCached(`game:${id}`, game);
  return game;
}

async function resolveGamesBatch(gameIds) {
  const ids = [...new Set(
    (gameIds || [])
      .map((g) => Number(g))
      .filter((n) => Number.isFinite(n) && n > 0)
  )];
  const result = new Map();
  if (ids.length === 0) return result;

  const missingAfterMemory = [];
  for (const id of ids) {
    const cached = getCached(`game:${id}`, GAME_CACHE_TTL);
    if (cached) result.set(id, cached);
    else missingAfterMemory.push(id);
  }
  if (missingAfterMemory.length === 0) return result;

  const docs = await BggGame.find({ gameId: { $in: missingAfterMemory } }).lean();
  const foundInMongo = new Set();
  for (const doc of docs) {
    const game = gameDocToObject(doc);
    result.set(doc.gameId, game);
    setCached(`game:${doc.gameId}`, game);
    foundInMongo.add(doc.gameId);
  }
  const stillMissing = missingAfterMemory.filter((id) => !foundInMongo.has(id));
  if (stillMissing.length === 0) return result;

  const CHUNK_SIZE = 20;
  for (let i = 0; i < stillMissing.length; i += CHUNK_SIZE) {
    const chunk = stillMissing.slice(i, i + CHUNK_SIZE);
    try {
      const thingXml = await fetchBgg(`${BGG_API}/thing?id=${chunk.join(',')}`);
      const thingParsed = parser.parse(thingXml);
      const thingItems = thingParsed?.items?.item;
      if (!thingItems) {
        console.warn(`[bgg/resolveGamesBatch] /thing returned no items for ids: ${chunk.join(',')}`);
        continue;
      }
      const arr = Array.isArray(thingItems) ? thingItems : [thingItems];
      for (const item of arr) {
        const game = parseGameItem(item);
        if (!Number.isFinite(game.id) || game.id <= 0) continue;
        await persistGame(game);
        setCached(`game:${game.id}`, game);
        result.set(game.id, game);
      }
    } catch (e) {
      console.warn(`[bgg/resolveGamesBatch] /thing batch failed for ids ${chunk.join(',')}: ${e.message || e}`);
    }
  }

  return result;
}

// GET /api/bgg/search?q=<query>
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 3) return res.json([]);

  const cacheKey = `search:${q.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const xml = await fetchBgg(`${BGG_API}/search?query=${encodeURIComponent(q)}&type=boardgame`);
    const parsed = parser.parse(xml);

    const root = parsed?.items;
    if (!root) return res.json([]);

    const rawItems = root.item || [];
    const items = Array.isArray(rawItems) ? rawItems : [rawItems];

    const results = items
      .map((item) => {
        const nameRaw = item.name;
        const nameArr = Array.isArray(nameRaw) ? nameRaw : [nameRaw];
        const primary = nameArr.find((n) => n['@_type'] === 'primary') || nameArr[0];
        const name = primary?.['@_value'] || '';
        const year = item.yearpublished?.['@_value'] ? Number(item.yearpublished['@_value']) : null;
        return { id: Number(item['@_id']), name, year, thumbnail: null };
      })
      .filter((g) => g.name)
      .sort((a, b) => (b.year || 0) - (a.year || 0))
      .slice(0, 15);

    // Batch-resolve thumbnails (memoria → Mongo → BGG, compartido entre usuarios)
    if (results.length > 0) {
      try {
        const gamesMap = await resolveGamesBatch(results.map((g) => g.id));
        results.forEach((g) => { g.thumbnail = gamesMap.get(g.id)?.thumbnail || null; });
      } catch {
        // thumbnails son opcionales, no bloqueamos el resultado
      }
    }

    setCached(cacheKey, results);
    res.json(results);
  } catch (err) {
    res.status(502).json({ message: 'No se pudo conectar con BGG' });
  }
});

// GET /api/bgg/game/:id
router.get('/game/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id || id <= 0) return res.status(400).json({ message: 'Invalid game ID' });

  try {
    const game = await resolveGame(id);
    if (!game) return res.status(404).json({ message: 'Juego no encontrado' });
    res.json(game);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ message: 'Juego no encontrado' });
    res.status(502).json({ message: 'No se pudo conectar con BGG' });
  }
});

// GET /api/bgg/coleccion/:bggUsername
router.get('/coleccion/:bggUsername', async (req, res) => {
  const { bggUsername } = req.params;
  const forceRefresh = req.query.refresh === '1';
  const cacheKey = `coleccion:${bggUsername.toLowerCase()}`;

  if (!forceRefresh) {
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);
  }

  try {
    const xml = await fetchBgg(`${BGG_API}/collection?username=${encodeURIComponent(bggUsername)}&own=1&stats=1`);
    const parsed = parser.parse(xml);

    const root = parsed?.items;
    if (!root) return res.status(404).json({ message: 'Usuario de BGG no encontrado o sin colección' });

    const rawItems = root.item || [];
    const items = Array.isArray(rawItems) ? rawItems : [rawItems];

    const collection = items.map((item) => {
      const stats = item.stats || {};
      const rating = stats.rating || {};
      return {
        id: item['@_objectid'],
        name: typeof item.name === 'object' ? item.name['#text'] ?? item.name['@_sortindex'] : item.name,
        thumbnail: item.thumbnail || null,
        image: item.image || null,
        yearPublished: item.yearpublished ? Number(item.yearpublished) : null,
        userRating: rating['@_value'] && rating['@_value'] !== 'N/A' ? Number(rating['@_value']) : null,
        bggRating: rating.average?.['@_value'] ? Number(rating.average['@_value']) : null,
        numPlays: item.numplays ? Number(item.numplays) : 0,
      };
    });

    setCached(cacheKey, collection);
    res.json(collection);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ message: 'Usuario de BGG no encontrado' });
    res.status(502).json({ message: 'No se pudo conectar con BGG' });
  }
});

// GET /api/bgg/partidas/:bggUsername
const PAGE_SIZE = 10;
const BGG_PAGE_SIZE = 30;
const PAGES_PER_BGG = BGG_PAGE_SIZE / PAGE_SIZE; // 3 client pages per BGG page

router.get('/partidas/:bggUsername', async (req, res) => {
  const { bggUsername } = req.params;
  const clientPage = Math.max(1, parseInt(req.query.page) || 1);
  const bggPage = Math.ceil(clientPage / PAGES_PER_BGG);
  const offsetWithinBgg = ((clientPage - 1) % PAGES_PER_BGG) * PAGE_SIZE;

  // Optional filters (passed through to BGG)
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const mindate = dateRe.test(req.query.mindate || '') ? req.query.mindate : null;
  const maxdate = dateRe.test(req.query.maxdate || '') ? req.query.maxdate : null;
  const gameId = /^\d+$/.test(req.query.id || '') ? req.query.id : null;

  const cacheKey = `partidas:${bggUsername.toLowerCase()}:bgg:${bggPage}:${mindate || '-'}:${maxdate || '-'}:${gameId || '-'}`;
  const forceRefresh = req.query.refresh === '1';

  if (!forceRefresh) {
    const cachedFull = getCached(cacheKey);
    if (cachedFull) {
      return res.json({
        total: cachedFull.total,
        page: clientPage,
        pageSize: PAGE_SIZE,
        plays: cachedFull.plays.slice(offsetWithinBgg, offsetWithinBgg + PAGE_SIZE),
      });
    }
  }

  try {
    const params = new URLSearchParams({
      username: bggUsername,
      page: String(bggPage),
    });
    if (mindate) params.set('mindate', mindate);
    if (maxdate) params.set('maxdate', maxdate);
    if (gameId) params.set('id', gameId);
    const xml = await fetchBgg(`${BGG_API}/plays?${params.toString()}`);
    const parsed = parser.parse(xml);

    const root = parsed?.plays;
    if (!root) return res.status(404).json({ message: 'Usuario de BGG no encontrado' });

    const rawPlays = root.play || [];
    const plays = Array.isArray(rawPlays) ? rawPlays : [rawPlays];

    const parsedPlays = plays.map((play) => {
      const playerNode = play.players?.player;
      const playersArr = playerNode
        ? (Array.isArray(playerNode) ? playerNode : [playerNode])
        : [];

      const commentsRaw = play.comments;
      const comments = typeof commentsRaw === 'string'
        ? commentsRaw
        : (commentsRaw?.['#text'] || null);

      return {
        id: play['@_id'],
        date: play['@_date'] || null,
        gameName: play.item?.['@_name'] || null,
        gameId: play.item?.['@_objectid'] || null,
        gameThumbnail: null,
        quantity: play['@_quantity'] ? Number(play['@_quantity']) : 1,
        duration: play['@_length'] ? Number(play['@_length']) : null,
        location: play['@_location'] || null,
        incomplete: play['@_incomplete'] === '1' || play['@_incomplete'] === 1,
        nowinstats: play['@_nowinstats'] === '1' || play['@_nowinstats'] === 1,
        comments: comments || null,
        players: playersArr.map((p) => ({
          name: p['@_name'] || null,
          username: p['@_username'] || null,
          userid: p['@_userid'] ? Number(p['@_userid']) : null,
          position: p['@_startposition'] || null,
          color: p['@_color'] || null,
          score: p['@_score'] !== undefined && p['@_score'] !== '' ? String(p['@_score']) : null,
          win: p['@_win'] === '1' || p['@_win'] === 1,
          new: p['@_new'] === '1' || p['@_new'] === 1,
          rating: p['@_rating'] && p['@_rating'] !== '0'
            ? Number(p['@_rating'])
            : null,
        })),
      };
    });

    // Enrich plays with game thumbnails via the shared persistent cache
    // (memoria → Mongo → BGG). Persiste por gameId, no por usuario.
    const uniqueGameIds = [...new Set(parsedPlays.map((p) => p.gameId).filter(Boolean))];
    const gamesMap = await resolveGamesBatch(uniqueGameIds);

    parsedPlays.forEach((p) => {
      if (p.gameId) {
        const game = gamesMap.get(Number(p.gameId));
        p.gameThumbnail = game?.thumbnail || null;
      }
    });

    const missing = uniqueGameIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0 && !gamesMap.get(id)?.thumbnail);
    if (missing.length > 0) {
      console.warn(`[bgg/partidas] no thumbnail for ids: ${missing.join(',')}`);
    }

    const fullPageData = {
      total: root['@_total'] ? Number(root['@_total']) : parsedPlays.length,
      plays: parsedPlays,
    };

    setCached(cacheKey, fullPageData);

    res.json({
      total: fullPageData.total,
      page: clientPage,
      pageSize: PAGE_SIZE,
      plays: fullPageData.plays.slice(offsetWithinBgg, offsetWithinBgg + PAGE_SIZE),
    });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ message: 'Usuario de BGG no encontrado' });
    res.status(502).json({ message: 'No se pudo conectar con BGG' });
  }
});

// Build geekplay.php form body. If `playId` is set, it's an edit; otherwise create.
function buildPlayForm(body, playId = null) {
  const {
    objectid, playdate, length, location, quantity = 1, comments,
    incomplete = false, nowinstats = false, players = [],
  } = body;

  const qty = Math.max(1, Math.min(99, parseInt(quantity) || 1));
  const len = length != null && length !== '' ? Math.max(0, parseInt(length) || 0) : null;

  const form = new URLSearchParams();
  form.set('ajax', '1');
  form.set('action', 'save');
  form.set('version', '2');
  form.set('objecttype', 'thing');
  if (playId) form.set('playid', String(playId));
  form.set('objectid', String(objectid));
  form.set('playdate', String(playdate));
  if (len != null) form.set('length', String(len));
  if (location) form.set('location', String(location).slice(0, 100));
  form.set('quantity', String(qty));
  if (comments) form.set('comments', String(comments).slice(0, 1000));
  form.set('incomplete', incomplete ? '1' : '0');
  form.set('nowinstats', nowinstats ? '1' : '0');

  players.forEach((p, i) => {
    const idx = `players[${i}]`;
    if (p.name) form.set(`${idx}[name]`, String(p.name).slice(0, 100));
    if (p.username) form.set(`${idx}[username]`, String(p.username).slice(0, 50));
    form.set(`${idx}[position]`, String(p.position ?? i + 1));
    if (p.color) form.set(`${idx}[color]`, String(p.color).slice(0, 30));
    if (p.score != null && p.score !== '') form.set(`${idx}[score]`, String(p.score).slice(0, 30));
    form.set(`${idx}[new]`, p.new ? '1' : '0');
    if (p.rating != null && Number(p.rating) > 0) form.set(`${idx}[rating]`, String(p.rating));
    form.set(`${idx}[win]`, p.win ? '1' : '0');
  });

  return form;
}

function validatePlayBody(body) {
  if (!/^\d+$/.test(String(body.objectid || ''))) {
    return 'ID de juego inválido';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.playdate || ''))) {
    return 'Fecha inválida (formato YYYY-MM-DD)';
  }
  if (!Array.isArray(body.players)) {
    return 'Lista de jugadores inválida';
  }
  return null;
}

async function submitToGeekplay(user, form, label) {
  let cookie;
  try {
    cookie = await getSessionCookie(user._id);
  } catch (e) {
    throw Object.assign(e, { status: e.status || 500 });
  }

  let bggRes;
  try {
    bggRes = await fetch(BGG_GEEKPLAY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookie,
        'User-Agent': 'Turnocero/1.0',
        'Origin': 'https://boardgamegeek.com',
        'Referer': 'https://boardgamegeek.com/',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: form.toString(),
    });
  } catch (e) {
    throw Object.assign(new Error(`No se pudo contactar BGG: ${e.message}`), { status: 502 });
  }

  if (bggRes.status === 401 || bggRes.status === 403) {
    clearSession(user._id);
    throw Object.assign(new Error('Sesión BGG inválida. Reconectá en /perfil.'), { status: 401 });
  }
  if (!bggRes.ok) {
    const text = await bggRes.text().catch(() => '');
    console.warn(`[bgg/partidas ${label}] ${bggRes.status}:`, text.slice(0, 300));
    throw Object.assign(new Error(`BGG respondió ${bggRes.status}`), { status: 502 });
  }

  const text = await bggRes.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = { raw: text.slice(0, 200) }; }
  return payload;
}

// GET /api/bgg/og/:bggUsername — public OG metadata for /bg-watch/:username crawlers.
// Returns displayName (Turnocero user if connected), play count, collection size,
// and the user's top-played game with thumbnail. Cached 30 min per username.
router.get('/og/:bggUsername', async (req, res) => {
  const { bggUsername } = req.params;
  const cacheKey = `og:${bggUsername.toLowerCase()}`;
  const cached = getCached(cacheKey, 30 * 60 * 1000);
  if (cached) return res.json(cached);

  try {
    // Look up the Turnocero user by bggUsername (case-insensitive) for displayName.
    const escaped = bggUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const userDoc = await User.findOne({ bggUsername: new RegExp(`^${escaped}$`, 'i') })
      .select('username displayName')
      .lean();
    const displayName = userDoc?.displayName || userDoc?.username || bggUsername;

    // Fetch BGG collection (top-played game + total games owned).
    let juegos = null;
    let topGame = null;
    try {
      const collXml = await fetchBgg(`${BGG_API}/collection?username=${encodeURIComponent(bggUsername)}&own=1&stats=1`);
      const parsedColl = parser.parse(collXml);
      const root = parsedColl?.items;
      if (root) {
        const rawItems = root.item || [];
        const items = Array.isArray(rawItems) ? rawItems : [rawItems];
        juegos = items.length;
        let maxPlays = 0;
        for (const item of items) {
          const plays = item.numplays ? Number(item.numplays) : 0;
          if (plays > maxPlays) {
            maxPlays = plays;
            topGame = {
              name: typeof item.name === 'object' ? item.name['#text'] : item.name,
              thumbnail: item.thumbnail || null,
              numPlays: plays,
            };
          }
        }
      }
    } catch {
      // Swallow — partial data is better than 500 for crawlers.
    }

    // Fetch total play count (BGG plays API returns it as @_total).
    let partidas = null;
    try {
      const playsXml = await fetchBgg(`${BGG_API}/plays?username=${encodeURIComponent(bggUsername)}&page=1`);
      const parsedPlays = parser.parse(playsXml);
      const total = parsedPlays?.plays?.['@_total'];
      partidas = total ? Number(total) : null;
    } catch {
      // Swallow.
    }

    if (juegos === null && partidas === null) {
      return res.status(404).json({});
    }

    const data = { displayName, bggUsername, partidas, juegos, topGame };
    setCached(cacheKey, data);
    res.json(data);
  } catch {
    res.status(500).json({});
  }
});

// POST /api/bgg/partidas — create a play in BGG
router.post('/partidas', protect, async (req, res) => {
  try {
    const user = req.user;
    if (!user.bggUsername) {
      return res.status(400).json({ message: 'Configurá tu username de BGG en el perfil' });
    }
    const validationError = validatePlayBody(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const form = buildPlayForm(req.body, null);
    let payload;
    try {
      payload = await submitToGeekplay(user, form, 'POST');
    } catch (e) {
      return res.status(e.status || 500).json({ message: e.message });
    }
    clearPartidasCache(user.bggUsername);
    res.json({ success: true, playid: payload.playid || payload.numplays || null, raw: payload });
  } catch (err) {
    console.error('Create play failed:', err);
    res.status(500).json({ message: err.message || 'Error al crear la partida' });
  }
});

// DELETE /api/bgg/partidas/:playId — delete a play from BGG
router.delete('/partidas/:playId', protect, async (req, res) => {
  try {
    const user = req.user;
    if (!user.bggUsername) {
      return res.status(400).json({ message: 'Configurá tu username de BGG en el perfil' });
    }
    const { playId } = req.params;
    if (!/^\d+$/.test(String(playId))) {
      return res.status(400).json({ message: 'ID de partida inválido' });
    }

    const form = new URLSearchParams();
    form.set('ajax', '1');
    form.set('action', 'delete');
    form.set('playid', String(playId));

    let payload;
    try {
      payload = await submitToGeekplay(user, form, 'DELETE');
    } catch (e) {
      return res.status(e.status || 500).json({ message: e.message });
    }
    clearPartidasCache(user.bggUsername);
    res.json({ success: true, raw: payload });
  } catch (err) {
    console.error('Delete play failed:', err);
    res.status(500).json({ message: err.message || 'Error al eliminar la partida' });
  }
});

// PUT /api/bgg/partidas/:playId — edit an existing play in BGG
router.put('/partidas/:playId', protect, async (req, res) => {
  try {
    const user = req.user;
    if (!user.bggUsername) {
      return res.status(400).json({ message: 'Configurá tu username de BGG en el perfil' });
    }
    const { playId } = req.params;
    if (!/^\d+$/.test(String(playId))) {
      return res.status(400).json({ message: 'ID de partida inválido' });
    }
    const validationError = validatePlayBody(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const form = buildPlayForm(req.body, playId);
    let payload;
    try {
      payload = await submitToGeekplay(user, form, 'PUT');
    } catch (e) {
      return res.status(e.status || 500).json({ message: e.message });
    }
    clearPartidasCache(user.bggUsername);
    res.json({ success: true, playid: playId, raw: payload });
  } catch (err) {
    console.error('Edit play failed:', err);
    res.status(500).json({ message: err.message || 'Error al editar la partida' });
  }
});

module.exports = router;
// Exposed for other routes (e.g. auth's bgg-connect handler) that need to
// invalidate the per-user in-memory cache after relevant mutations.
module.exports.clearUserCache = clearUserCache;
// Internal: clear the in-memory L1 cache. Tests use this to isolate runs.
module.exports.__resetCache = () => cache.clear();
