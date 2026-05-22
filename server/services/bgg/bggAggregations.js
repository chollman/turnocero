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
//   matchea bggUsername). $arrayElemAt con array vacío supuestamente
//   devuelve null también, pero su interacción con $ne/$eq downstream
//   resultó frágil — $reduce es explícito.
// - El match de username dentro del array de `players` es case-
//   insensitive via $toLower (BGG mismo devuelve cases inconsistentes).
async function computeGameStats(lowerBggUsername, gameId) {
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
              $cond: [
                {
                  $eq: [
                    { $toLower: { $ifNull: ["$$this.username", ""] } },
                    lowerBggUsername,
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

module.exports = {
  computeGameStats,
  computePlayedGames,
  computeTopPlayedGame,
};
