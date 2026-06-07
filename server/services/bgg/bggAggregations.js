// Helpers de aggregation sobre `BggPlay`. Antes vivían inline en
// `routes/bgg.js` (1856 líneas). Acá quedan testeables aparte y
// reusables desde otros routers/services que deriven stats del log de
// partidas.
//
// REGLA CRÍTICA (memory: feedback-bgg-prefer-plays-aggregation):
// cualquier widget que muestre "qué jugó / cuánto / cómo le fue" debe
// derivar de aquí, NUNCA de `BggCollection`. La colección omite plays
// de juegos no-poseídos y queda vacía para perfiles con colección
// privada (caso H3rmit87). El log de partidas no tiene ese blind spot.
//
// REGLA CRÍTICA (memory: feedback-bgg-username-case): el caller debe
// pasar `bggUsername` en lowercase porque `BggPlay.bggUsername` tiene
// `lowercase: true` en el schema. Cualquier llamada desde fuera con un
// User.bggUsername case-preserved debe normalizar antes.

const BggPlay = require("../../models/BggPlay");

// Stats globales de un usuario para un juego específico: wins, rated
// (cantidad de partidas que el user marcó como propias), avgDuration,
// lastDate. Usado por la vista `/bg-watch/:user/juego/:gameId`.
//
// Notas técnicas:
// - $reduce nos da un "owner found?" sentinel (`null` si ningún player
//   matchea al dueño). $arrayElemAt con array vacío supuestamente
//   devuelve null también, pero su interacción con $ne/$eq downstream
//   resultó frágil — $reduce es explícito.
// - Identidad del dueño: en vez de comparar solo `username === bggUsername`,
//   se computa la clave de identidad del player (`u:<username>` si hay
//   username, si no `n:<name>` — mismo formato que rawKeyFor /
//   computePlayedCoPlayers) y se testea contra `selfKeys`. Así las partidas
//   que el dueño cargó bajo un alias marcado "sos vos" (isSelf) cuentan en su
//   win-rate. `selfKeys` lo provee el caller vía loadSelfKeys; el default
//   `[u:<bggUsername>]` reproduce exactamente el comportamiento previo (sin
//   curación). Trim + toLower mirroran rawKeyFor para no des-matchear por
//   espacios/case.
async function computeGameStats(
  lowerBggUsername,
  gameId,
  { selfKeys = [`u:${lowerBggUsername}`] } = {},
) {
  const agg = await BggPlay.aggregate([
    { $match: { bggUsername: lowerBggUsername, gameId: String(gameId) } },
    {
      $project: {
        duration: 1,
        date: 1,
        ownerMatch: {
          $reduce: {
            input: { $ifNull: ["$players", []] },
            initialValue: null,
            in: {
              $let: {
                vars: {
                  u: {
                    $toLower: {
                      $trim: { input: { $ifNull: ["$$this.username", ""] } },
                    },
                  },
                  n: {
                    $toLower: {
                      $trim: { input: { $ifNull: ["$$this.name", ""] } },
                    },
                  },
                },
                in: {
                  $cond: [
                    {
                      $in: [
                        {
                          $cond: [
                            { $ne: ["$$u", ""] },
                            { $concat: ["u:", "$$u"] },
                            { $concat: ["n:", "$$n"] },
                          ],
                        },
                        selfKeys,
                      ],
                    },
                    { win: { $eq: ["$$this.win", true] } },
                    "$$value",
                  ],
                },
              },
            },
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        rated: {
          $sum: { $cond: [{ $ne: ["$ownerMatch", null] }, 1, 0] },
        },
        wins: {
          $sum: { $cond: [{ $eq: ["$ownerMatch.win", true] }, 1, 0] },
        },
        avgDuration: {
          $avg: { $cond: [{ $gt: ["$duration", 0] }, "$duration", null] },
        },
        lastDate: { $max: "$date" },
      },
    },
  ]);
  if (!agg.length) {
    return { wins: 0, rated: 0, avgDuration: null, lastDate: null };
  }
  const row = agg[0];
  return {
    wins: row.wins || 0,
    rated: row.rated || 0,
    avgDuration: row.avgDuration != null ? Math.round(row.avgDuration) : null,
    lastDate: row.lastDate || null,
  };
}

// Lista per-game con `numPlays` (sumando `quantity` de cada play),
// ordenada desc. Powers la tab "Por juego" del PartidasPanel —
// reemplaza la lista derivada de `BggCollection` que era buggy
// (omitía plays unowned + fallaba con colección privada).
async function computePlayedGames(lowerBggUsername) {
  const agg = await BggPlay.aggregate([
    { $match: { bggUsername: lowerBggUsername, gameId: { $ne: null } } },
    {
      $group: {
        _id: "$gameId",
        numPlays: { $sum: { $ifNull: ["$quantity", 1] } },
        name: { $last: "$gameName" },
        thumbnail: { $last: "$gameThumbnail" },
      },
    },
    { $sort: { numPlays: -1, _id: 1 } },
  ]);
  return agg.map((row) => ({
    id: row._id,
    name: row.name || null,
    thumbnail: row.thumbnail || null,
    numPlays: row.numPlays,
  }));
}

// Como computePlayedGames pero agrega `lastPlayedDate` (max date) y toma
// name/thumbnail de la partida MÁS RECIENTE (sort por date asc + $last).
// Pensada para el selector "Mis juegos" al cargar una partida, que ordena
// por recencia. NO reemplaza a computePlayedGames (esa alimenta la tab "Por
// juego" con orden por numPlays — no la tocamos para no cambiar ese orden).
async function computePlayedGamesWithRecency(lowerBggUsername) {
  const agg = await BggPlay.aggregate([
    { $match: { bggUsername: lowerBggUsername, gameId: { $ne: null } } },
    { $sort: { date: 1 } },
    {
      $group: {
        _id: "$gameId",
        numPlays: { $sum: { $ifNull: ["$quantity", 1] } },
        name: { $last: "$gameName" },
        thumbnail: { $last: "$gameThumbnail" },
        lastPlayedDate: { $max: "$date" },
      },
    },
  ]);
  return agg.map((row) => ({
    id: row._id,
    name: row.name || null,
    thumbnail: row.thumbnail || null,
    numPlays: row.numPlays,
    lastPlayedDate: row.lastPlayedDate || null,
  }));
}

// Une la lista de juegos JUGADOS (de BggPlay, ya con recencia) con la
// LUDOTECA (colección BGG) en una sola lista per-user para el selector al
// cargar partidas. Función PURA (sin I/O) → testeable sin Mongo.
//
//   - Dedup por gameId (normalizado a String).
//   - `owned` true si el juego está en la colección.
//   - `image`/`year` se completan desde la colección (BggPlay no los guarda).
//   - Orden: lastPlayedDate desc (los nunca-jugados, sin fecha, van al fondo)
//     → numPlays desc → nombre asc.
//
// `played`: salida de computePlayedGamesWithRecency.
// `collectionGames`: salida de resolveCollection (puede ser []).
function mergeUserGameList(played = [], collectionGames = []) {
  const byId = new Map();

  for (const g of played) {
    const id = String(g.id);
    byId.set(id, {
      id,
      name: g.name || null,
      thumbnail: g.thumbnail || null,
      image: null,
      year: null,
      numPlays: g.numPlays || 0,
      lastPlayedDate: g.lastPlayedDate || null,
      owned: false,
    });
  }

  for (const c of collectionGames) {
    const id = String(c.id);
    const existing = byId.get(id);
    if (existing) {
      existing.owned = true;
      existing.image = existing.image || c.image || null;
      existing.thumbnail = existing.thumbnail || c.thumbnail || null;
      existing.name = existing.name || c.name || null;
      existing.year = existing.year || c.yearPublished || null;
    } else {
      byId.set(id, {
        id,
        name: c.name || null,
        thumbnail: c.thumbnail || null,
        image: c.image || null,
        year: c.yearPublished || null,
        numPlays: 0,
        lastPlayedDate: null,
        owned: true,
      });
    }
  }

  return [...byId.values()].sort((a, b) => {
    const da = a.lastPlayedDate || "";
    const db = b.lastPlayedDate || "";
    if (da !== db) return db.localeCompare(da); // recencia desc (YYYY-MM-DD)
    if ((b.numPlays || 0) !== (a.numPlays || 0)) {
      return (b.numPlays || 0) - (a.numPlays || 0);
    }
    return (a.name || "").localeCompare(b.name || "", "es");
  });
}

// El juego más jugado por el usuario. Mismo agg que computePlayedGames
// pero con $limit: 1 — pensado para la stats card en /bg-watch/:user.
// Devuelve null si el user no tiene plays con gameId.
async function computeTopPlayedGame(lowerBggUsername) {
  const agg = await BggPlay.aggregate([
    { $match: { bggUsername: lowerBggUsername, gameId: { $ne: null } } },
    {
      $group: {
        _id: "$gameId",
        count: { $sum: { $ifNull: ["$quantity", 1] } },
        name: { $last: "$gameName" },
        thumbnail: { $last: "$gameThumbnail" },
      },
    },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 1 },
  ]);
  if (!agg.length || !agg[0].count) return null;
  const top = agg[0];
  return {
    id: top._id,
    name: top.name || null,
    thumbnail: top.thumbnail || null,
    numPlays: top.count,
  };
}

// Ubicaciones distintas usadas por el usuario en sus partidas, con conteo y
// recencia. Alimenta el selector paginado al cargar partidas (GET
// /api/bgg/mis-ubicaciones). A diferencia de los juegos, las ubicaciones viven
// enteras en BggPlay.location (strings), así que no hace falta materializar:
// se derivan acá en cada lectura (cardinalidad chica por usuario).
//
// Agrupa por la ubicación cruda (tal cual la tipeó el usuario en BGG),
// ignorando null/vacío/whitespace. El filtro por término, el orden final y la
// paginación los hace el route (en memoria).
async function computePlayedLocations(lowerBggUsername) {
  const agg = await BggPlay.aggregate([
    { $match: { bggUsername: lowerBggUsername } },
    {
      $project: {
        location: { $trim: { input: { $ifNull: ["$location", ""] } } },
        quantity: 1,
        date: 1,
      },
    },
    { $match: { location: { $ne: "" } } },
    {
      $group: {
        _id: "$location",
        numPlays: { $sum: { $ifNull: ["$quantity", 1] } },
        lastPlayedDate: { $max: "$date" },
      },
    },
  ]);
  return agg.map((row) => ({
    name: row._id,
    numPlays: row.numPlays,
    lastPlayedDate: row.lastPlayedDate || null,
  }));
}

// Cantidad de partidas previas de un usuario para un juego (suma de quantity).
// Alimenta la autodetección del flag "Nuevo" al cargar una partida: si el dueño
// no jugó nunca ese juego (numPlays === 0), se sugiere marcarlo como nuevo.
async function computeGamePlayCount(lowerBggUsername, gameId) {
  const agg = await BggPlay.aggregate([
    { $match: { bggUsername: lowerBggUsername, gameId: String(gameId) } },
    {
      $group: { _id: null, numPlays: { $sum: { $ifNull: ["$quantity", 1] } } },
    },
  ]);
  return agg.length ? agg[0].numPlays : 0;
}

// Compañeros distintos con los que el usuario jugó (de los players de sus
// partidas), con conteo y recencia. Alimenta el selector paginado al agregar un
// jugador (GET /api/bgg/mis-jugadores). Identidad: username BGG (lowercase) si
// existe, si no el nombre (lowercase) — así "Juan" sin usuario y "Juan @juanbgg"
// no se mezclan por casualidad, pero el mismo @juanbgg colapsa siempre.
// Excluye al propio dueño (ya es el jugador 1) e ignora entradas sin datos.
async function computePlayedCoPlayers(lowerBggUsername) {
  const agg = await BggPlay.aggregate([
    { $match: { bggUsername: lowerBggUsername } },
    { $unwind: "$players" },
    {
      $project: {
        date: 1,
        quantity: 1,
        name: { $trim: { input: { $ifNull: ["$players.name", ""] } } },
        username: { $trim: { input: { $ifNull: ["$players.username", ""] } } },
      },
    },
    { $match: { $or: [{ name: { $ne: "" } }, { username: { $ne: "" } }] } },
    // Excluir al dueño (su username BGG, case-insensitive).
    {
      $match: { $expr: { $ne: [{ $toLower: "$username" }, lowerBggUsername] } },
    },
    {
      $addFields: {
        key: {
          $cond: [
            { $ne: ["$username", ""] },
            { $concat: ["u:", { $toLower: "$username" }] },
            { $concat: ["n:", { $toLower: "$name" }] },
          ],
        },
      },
    },
    { $sort: { date: 1 } },
    {
      $group: {
        _id: "$key",
        name: { $last: "$name" },
        username: { $last: "$username" },
        numPlays: { $sum: { $ifNull: ["$quantity", 1] } },
        lastPlayedDate: { $max: "$date" },
      },
    },
  ]);
  return agg.map((r) => ({
    name: r.name || r.username || "",
    username: r.username || "",
    numPlays: r.numPlays,
    lastPlayedDate: r.lastPlayedDate || null,
  }));
}

// La "última juntada": el roster (nombre + @BGG) y la ubicación de la partida
// más reciente del usuario. Alimenta el botón "Usar última juntada" del form de
// carga — precarga jugadores + ubicación sin volver a tipearlos. Orden por fecha
// desc, desempate por _id desc (memory: feedback-mongo-latest-tiebreak — con
// fechas string empatadas, el ObjectId monótono rompe el empate hacia el insert
// más nuevo). Devuelve null si el usuario no tiene partidas. Excluye
// score/win/new: es una juntada NUEVA, solo importa quién y dónde.
async function computeLastJuntada(lowerBggUsername) {
  const doc = await BggPlay.findOne({ bggUsername: lowerBggUsername })
    .sort({ date: -1, _id: -1 })
    .lean();
  if (!doc) return null;

  const players = (doc.players || [])
    .map((p) => ({
      name: (p.name || "").trim(),
      username: (p.username || "").trim(),
    }))
    .filter((p) => p.name || p.username);

  return {
    location: (doc.location || "").trim(),
    date: doc.date || null,
    gameName: doc.gameName || null,
    players,
  };
}

module.exports = {
  computeGameStats,
  computeLastJuntada,
  computePlayedGames,
  computePlayedGamesWithRecency,
  mergeUserGameList,
  computeTopPlayedGame,
  computePlayedLocations,
  computeGamePlayCount,
  computePlayedCoPlayers,
};
