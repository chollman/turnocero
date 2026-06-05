// Cache materializado de "Mis juegos" por usuario (BggUserGame). Es un cache
// que se AUTO-RECONSTRUYE desde las fuentes de verdad (BggPlay + BggCollection),
// no una estructura sincronizada a mano. Alimenta el selector paginado al
// cargar partidas (GET /api/bgg/mis-juegos).
//
// Estrategia:
//   - rebuildUserGames: deriva el set (mergeUserGameList) y reconcilia la tabla
//     con bulkWrite (upsert presentes + delete ausentes). Sin wipe destructivo.
//   - ensureFreshUserGames: reconstruye lazy al leer si está vieja (TTL 6h) o
//     sucia (User.bggSync.userGamesBuiltAt = null).
//   - markUserGamesDirty / wipeUserGames: invalidación desde los eventos que
//     cambian datos (mutación de partida, sync, disconnect).
//
// Casing: BggUserGame.bggUsername se normaliza lowercase; User.bggUsername es
// case-preserved → updates a User usan collation strength 2 (memory:
// feedback-bgg-username-case).

const BggUserGame = require("../../models/BggUserGame");
const User = require("../../models/User");
const logger = require("../../utils/logger");
const {
  computePlayedGamesWithRecency,
  mergeUserGameList,
} = require("./bggAggregations");
const { resolveCollection } = require("./bggResolve");

const USER_GAMES_TTL_MS = 6 * 60 * 60 * 1000; // 6h: cota de propagación de cambios de colección

// Normaliza un nombre para búsqueda accent/case-insensitive.
function normalizeForSearch(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Dedupe de rebuilds concurrentes por usuario. Privado a este módulo (NO el
// withUserLock compartido, que también sirve a probe/reconcile — mezclarlos
// devolvería el resultado de un work a callers de otro; memory:
// feedback-user-lock-semantics).
const inFlight = new Map();
function dedupeRebuild(lower, fn) {
  const pending = inFlight.get(lower);
  if (pending) return pending;
  const p = Promise.resolve()
    .then(fn)
    .finally(() => {
      if (inFlight.get(lower) === p) inFlight.delete(lower);
    });
  inFlight.set(lower, p);
  return p;
}

async function stampUserGamesBuilt(lower) {
  try {
    await User.updateOne(
      { bggUsername: lower },
      { $set: { "bggSync.userGamesBuiltAt": new Date() } },
      { collation: { locale: "en", strength: 2 } },
    );
  } catch (err) {
    logger.warn("[bgg/userGames] stamp built failed", {
      bggUsername: lower,
      error: err.message,
    });
  }
}

// Reconstruye la tabla del usuario desde BggPlay + BggCollection.
async function rebuildUserGames(bggUsername) {
  const lower = String(bggUsername).toLowerCase();

  const played = await computePlayedGamesWithRecency(lower);
  let collection = [];
  try {
    collection = await resolveCollection(bggUsername);
  } catch (_) {
    // colección privada/inexistente → solo jugados
  }
  const desired = mergeUserGameList(played, collection);
  const desiredIds = desired.map((g) => String(g.id));

  const ops = desired.map((g) => ({
    updateOne: {
      filter: { bggUsername: lower, gameId: String(g.id) },
      update: {
        $set: {
          name: g.name || null,
          thumbnail: g.thumbnail || null,
          image: g.image || null,
          year: g.year || null,
          numPlays: g.numPlays || 0,
          lastPlayedDate: g.lastPlayedDate || null,
          owned: !!g.owned,
          searchName: normalizeForSearch(g.name || ""),
        },
      },
      upsert: true,
    },
  }));
  // Borra filas que ya no están en el set deseado (incluye el caso desired
  // vacío → $nin:[] matchea cualquier fila → wipe).
  ops.push({
    deleteMany: { filter: { bggUsername: lower, gameId: { $nin: desiredIds } } },
  });

  await BggUserGame.bulkWrite(ops, { ordered: false });
  await stampUserGamesBuilt(lower);
  return desired.length;
}

// Reconstruye si la tabla está vieja (TTL) o sucia (builtAt null). Dedupea
// rebuilds concurrentes del mismo usuario.
async function ensureFreshUserGames(bggUsername) {
  const lower = String(bggUsername).toLowerCase();
  const user = await User.findOne({ bggUsername: lower })
    .collation({ locale: "en", strength: 2 })
    .select("bggSync.userGamesBuiltAt")
    .lean();
  const builtAt = user?.bggSync?.userGamesBuiltAt;
  const fresh =
    builtAt && Date.now() - new Date(builtAt).getTime() < USER_GAMES_TTL_MS;
  if (fresh) return;
  await dedupeRebuild(lower, () => rebuildUserGames(bggUsername));
}

// Marca la tabla sucia → se reconstruye en la próxima lectura. No bloqueante
// (las mutaciones de partida quedan rápidas). Best-effort.
async function markUserGamesDirty(bggUsername) {
  try {
    await User.updateOne(
      { bggUsername: String(bggUsername).toLowerCase() },
      { $set: { "bggSync.userGamesBuiltAt": null } },
      { collation: { locale: "en", strength: 2 } },
    );
  } catch (err) {
    logger.warn("[bgg/userGames] mark dirty failed", {
      bggUsername,
      error: err.message,
    });
  }
}

// Borra la tabla del usuario + marca sucia (cambio/disconnect de cuenta BGG).
async function wipeUserGames(bggUsername) {
  const lower = String(bggUsername).toLowerCase();
  await BggUserGame.deleteMany({ bggUsername: lower });
  await markUserGamesDirty(bggUsername);
}

module.exports = {
  USER_GAMES_TTL_MS,
  normalizeForSearch,
  rebuildUserGames,
  ensureFreshUserGames,
  markUserGamesDirty,
  wipeUserGames,
};
