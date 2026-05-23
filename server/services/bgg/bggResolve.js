// Resolución de entidades BGG con el patrón memoria → Mongo → BGG.
// (memory: feedback-bgg-cache-pattern)
//
// `BggGame` (Mongo) cachea los detalles inmutables (name, image,
// thumbnail, year, players) por gameId. Una vez ahí, la entry es
// compartida entre todos los usuarios y no se invalida — el game data
// no cambia. La capa L1 (bggCache.js) cachea la conversión a la API
// shape para evitar el roundtrip a Mongo dentro de un window corto.
//
// `BggCollection` cachea la colección de un user con TTL 6h. El cliente
// puede bypassear via `?refresh=1` (forceRefresh=true).
//
// `fetchBgg` es el único wrapper sobre `fetch` global hacia BGG. Maneja
// el 202 (BGG encola pedidos) reintentando una vez después de 2s. Tira
// con `err.status` el status code para que el caller pueda diferenciar
// 404 (user no existe) de 500 (BGG caído).

const BggGame = require("../../models/BggGame");
const BggCollection = require("../../models/BggCollection");
const logger = require("../../utils/logger");
const {
  getCached,
  setCached,
  CACHE_TTL,
} = require("./bggCache");
const {
  parser,
  parseGameItem,
  gameDocToObject,
  parseCollectionXml,
} = require("./bggParse");

const BGG_API = "https://boardgamegeek.com/xmlapi2";
const GAME_CACHE_TTL = CACHE_TTL; // 30 min — game data es inmutable, no hay urgencia
const COLLECTION_MONGO_TTL = 6 * 60 * 60 * 1000; // 6h

async function fetchBgg(url) {
  const headers = { "User-Agent": "Turnocero/1.0" };
  if (process.env.BGG_API_KEY)
    headers.Authorization = `Bearer ${process.env.BGG_API_KEY}`;

  let res = await fetch(url, { headers });

  if (res.status === 202) {
    // BGG encola el pedido (procesando) — reintentar una vez tras 2s.
    await new Promise((r) => {
      setTimeout(r, 2000);
    });
    res = await fetch(url, { headers });
  }

  if (!res.ok) {
    const err = new Error(`BGG responded with ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.text();
}

// Upsert un game en BggGame. Se llama después de un fetch exitoso a
// /thing — la próxima vez que cualquier user pida ese game (resolveGame
// o el batch), sale de Mongo sin tocar BGG.
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
    { upsert: true },
  );
}

// Resuelve un game por ID con el patrón memoria → Mongo → BGG.
// Devuelve null si el id es inválido o BGG no encuentra el game.
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

// Batch — para enriquecer listas (e.g. thumbnails de partidas). Pide a
// BGG en chunks de 20 IDs (`/thing?id=1,2,3,...`) para reducir round-
// trips. Cada chunk persiste en Mongo + L1 cache.
async function resolveGamesBatch(gameIds) {
  const ids = [
    ...new Set(
      (gameIds || [])
        .map((g) => Number(g))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];
  const result = new Map();
  if (ids.length === 0) return result;

  const missingAfterMemory = [];
  for (const id of ids) {
    const cached = getCached(`game:${id}`, GAME_CACHE_TTL);
    if (cached) result.set(id, cached);
    else missingAfterMemory.push(id);
  }
  if (missingAfterMemory.length === 0) return result;

  const docs = await BggGame.find({
    gameId: { $in: missingAfterMemory },
  }).lean();
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
      const thingXml = await fetchBgg(`${BGG_API}/thing?id=${chunk.join(",")}`);
      const thingParsed = parser.parse(thingXml);
      const thingItems = thingParsed?.items?.item;
      if (!thingItems) {
        logger.warn("[bgg/resolveGamesBatch] /thing returned no items", {
          ids: chunk,
        });
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
      logger.warn("[bgg/resolveGamesBatch] /thing batch failed", {
        ids: chunk,
        error: e.message || String(e),
      });
    }
  }

  return result;
}

// Colección de un user. TTL Mongo 6h — más laxo que game porque las
// colecciones cambian (user agrega/borra owned games). `?refresh=1`
// (forceRefresh=true) bypassea ambas capas y va directo a BGG.
async function resolveCollection(bggUsername, opts = {}) {
  const { forceRefresh = false } = opts;
  const lower = bggUsername.toLowerCase();
  const cacheKey = `coleccion:${lower}`;

  if (!forceRefresh) {
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const doc = await BggCollection.findOne({ bggUsername: lower }).lean();
    if (
      doc &&
      Date.now() - doc.lastFetchedAt.getTime() < COLLECTION_MONGO_TTL
    ) {
      setCached(cacheKey, doc.games);
      return doc.games;
    }
  }

  const xml = await fetchBgg(
    `${BGG_API}/collection?username=${encodeURIComponent(bggUsername)}&own=1&stats=1`,
  );
  const games = parseCollectionXml(xml);
  if (!games) {
    const err = new Error("Usuario de BGG no encontrado o sin colección");
    err.status = 404;
    throw err;
  }

  await BggCollection.updateOne(
    { bggUsername: lower },
    { $set: { games, lastFetchedAt: new Date() } },
    { upsert: true },
  );
  setCached(cacheKey, games);
  return games;
}

module.exports = {
  BGG_API,
  fetchBgg,
  persistGame,
  resolveGame,
  resolveGamesBatch,
  resolveCollection,
};
