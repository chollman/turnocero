// L1 (in-memory) cache para datos BGG por-usuario y por-query. La capa
// L2 (Mongo persistente — BggGame, BggCollection, BggPlay) vive en sus
// propios modelos; esta capa solo cubre el window corto entre fetches
// recientes.
//
// PATRÓN (memory: feedback-bgg-cache-pattern):
//   memoria → Mongo → BGG
//
// El cliente puede bypassear esta capa mandando `?refresh=1` — el
// handler en la route invalida la entry L1 antes de ir a BGG. El cache
// es opt-out, no opt-in.
//
// TTL default 30 min. El cooldown del botón "↻ Actualizar" del cliente
// (60s persistente en User.bggSync.lastManualRefresh*At) es ortogonal
// a este TTL: protege contra spam de invalidaciones, no acelera reads.

const CACHE_TTL = 30 * 60 * 1000; // 30 min

const cache = new Map();

function getCached(key, ttl = CACHE_TTL) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

// Borra todas las entries del cache de partidas (paginas/filtros) de un
// user. Se usa cuando muta `/api/bgg/partidas` (POST/PUT/DELETE) o se
// reconnect la BGG account: el cache queda desactualizado y el próximo
// read va a BGG fresh.
function clearPartidasCache(bggUsername) {
  const prefix = `partidas:${String(bggUsername).toLowerCase()}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

// Borra TODAS las entries L1 específicas de un BGG username: partidas
// (todas las pages/filters), coleccion, og metadata. NO toca Mongo —
// eso lo hace `clearUserCache` en routes/bgg.js que orquesta L1 + L2.
function clearL1Cache(bggUsername) {
  const lower = String(bggUsername).toLowerCase();
  cache.delete(`coleccion:${lower}`);
  cache.delete(`og:${lower}`);
  clearPartidasCache(bggUsername);
}

// Solo para tests — wipe completo del cache. NO usar en código de
// producción.
function _resetForTests() {
  cache.clear();
}

module.exports = {
  CACHE_TTL,
  cache, // exportado para introspección en tests; mutarlo desde fuera es discouraged
  getCached,
  setCached,
  clearPartidasCache,
  clearL1Cache,
  _resetForTests,
};
