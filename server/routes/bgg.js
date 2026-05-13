const express = require('express');
const router = express.Router();
const { XMLParser } = require('fast-xml-parser');

const BGG_API = 'https://boardgamegeek.com/xmlapi2';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
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

async function fetchBgg(url) {
  const headers = { 'User-Agent': 'Turnocero/1.0' };
  if (process.env.BGG_API_KEY) headers['Authorization'] = `Bearer ${process.env.BGG_API_KEY}`;

  let res = await fetch(url, { headers });

  if (res.status === 202) {
    // BGG encola el pedido — reintentar una vez después de 2s
    await new Promise((r) => setTimeout(r, 2000));
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
      .slice(0, 15)
      .map((item) => {
        const nameRaw = item.name;
        const nameArr = Array.isArray(nameRaw) ? nameRaw : [nameRaw];
        const primary = nameArr.find((n) => n['@_type'] === 'primary') || nameArr[0];
        const name = primary?.['@_value'] || '';
        const year = item.yearpublished?.['@_value'] ? Number(item.yearpublished['@_value']) : null;
        return { id: Number(item['@_id']), name, year, thumbnail: null };
      })
      .filter((g) => g.name);

    // Batch-fetch thumbnails in a single request
    if (results.length > 0) {
      try {
        const ids = results.map((g) => g.id).join(',');
        const thingXml = await fetchBgg(`${BGG_API}/thing?id=${ids}&type=boardgame`);
        const thingParsed = parser.parse(thingXml);
        const thingItems = thingParsed?.items?.item;
        if (thingItems) {
          const arr = Array.isArray(thingItems) ? thingItems : [thingItems];
          const thumbMap = Object.fromEntries(arr.map((i) => [Number(i['@_id']), i.thumbnail || null]));
          results.forEach((g) => { g.thumbnail = thumbMap[g.id] || null; });
        }
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

  const cacheKey = `game:${id}`;
  const cached = getCached(cacheKey, GAME_CACHE_TTL);
  if (cached) return res.json(cached);

  try {
    const xml = await fetchBgg(`${BGG_API}/thing?id=${id}&type=boardgame`);
    const parsed = parser.parse(xml);

    const item = parsed?.items?.item;
    if (!item) return res.status(404).json({ message: 'Juego no encontrado' });

    const nameRaw = item.name;
    const nameArr = Array.isArray(nameRaw) ? nameRaw : [nameRaw];
    const primary = nameArr.find((n) => n['@_type'] === 'primary') || nameArr[0];
    const name = primary?.['@_value'] || '';

    const game = {
      id: Number(item['@_id']),
      name,
      thumbnail: item.thumbnail || null,
      image: item.image || null,
      year: item.yearpublished?.['@_value'] ? Number(item.yearpublished['@_value']) : null,
      minPlayers: item.minplayers?.['@_value'] ? Number(item.minplayers['@_value']) : null,
      maxPlayers: item.maxplayers?.['@_value'] ? Number(item.maxplayers['@_value']) : null,
    };

    setCached(cacheKey, game, GAME_CACHE_TTL);
    res.json(game);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ message: 'Juego no encontrado' });
    res.status(502).json({ message: 'No se pudo conectar con BGG' });
  }
});

// GET /api/bgg/coleccion/:bggUsername
router.get('/coleccion/:bggUsername', async (req, res) => {
  const { bggUsername } = req.params;
  const cacheKey = `coleccion:${bggUsername.toLowerCase()}`;

  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

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
router.get('/partidas/:bggUsername', async (req, res) => {
  const { bggUsername } = req.params;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const cacheKey = `partidas:${bggUsername.toLowerCase()}:${page}`;

  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const xml = await fetchBgg(`${BGG_API}/plays?username=${encodeURIComponent(bggUsername)}&page=${page}`);
    const parsed = parser.parse(xml);

    const root = parsed?.plays;
    if (!root) return res.status(404).json({ message: 'Usuario de BGG no encontrado' });

    const rawPlays = root.play || [];
    const plays = Array.isArray(rawPlays) ? rawPlays : [rawPlays];

    const result = {
      total: root['@_total'] ? Number(root['@_total']) : plays.length,
      page,
      plays: plays.map((play) => ({
        id: play['@_id'],
        date: play['@_date'] || null,
        gameName: play.item?.['@_name'] || null,
        gameId: play.item?.['@_objectid'] || null,
        quantity: play['@_quantity'] ? Number(play['@_quantity']) : 1,
        duration: play['@_length'] ? Number(play['@_length']) : null,
        location: play['@_location'] || null,
      })),
    };

    setCached(cacheKey, result);
    res.json(result);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ message: 'Usuario de BGG no encontrado' });
    res.status(502).json({ message: 'No se pudo conectar con BGG' });
  }
});

module.exports = router;
