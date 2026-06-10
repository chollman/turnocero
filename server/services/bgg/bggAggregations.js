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
const { rawKeyFor } = require("./bggPlayerOverlay");
const { isAnonymousName, ANON_MONGO_REGEX } = require("./anonymousPlayer");

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

// Stats GLOBALES del usuario (todos los juegos), para el sidebar del perfil
// (widget Win rate + numerales). Mismo patrón de identidad que computeGameStats
// (ownerMatch $reduce + selfKeys overlay, para que las victorias bajo un alias
// "sos vos" cuenten), pero SIN filtrar por gameId. Una sola aggregation.
//
// IMPORTANTE: deriva del LOG COMPLETO de partidas, no de la página visible —
// el win-rate y los totales son correctos sin importar la paginación/filtro de
// la lista. No "arreglar" esto para usar el page-sample.
//
// Devuelve { totalWins, totalRated, totalPlays, uniqueGames, avgDuration,
// firstDate, lastDate }. winRate se deriva en el cliente (null si totalRated 0).
async function computeOverallStats(
  lowerBggUsername,
  { selfKeys = [`u:${lowerBggUsername}`] } = {},
) {
  const agg = await BggPlay.aggregate([
    { $match: { bggUsername: lowerBggUsername } },
    {
      $project: {
        duration: 1,
        date: 1,
        gameId: 1,
        quantity: 1,
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
        totalPlays: { $sum: { $ifNull: ["$quantity", 1] } },
        rated: { $sum: { $cond: [{ $ne: ["$ownerMatch", null] }, 1, 0] } },
        wins: { $sum: { $cond: [{ $eq: ["$ownerMatch.win", true] }, 1, 0] } },
        avgDuration: {
          $avg: { $cond: [{ $gt: ["$duration", 0] }, "$duration", null] },
        },
        firstDate: { $min: "$date" },
        lastDate: { $max: "$date" },
        gameIds: { $addToSet: "$gameId" },
      },
    },
    {
      $project: {
        totalPlays: 1,
        rated: 1,
        wins: 1,
        avgDuration: 1,
        firstDate: 1,
        lastDate: 1,
        // $setDifference saca el null del set de gameIds (plays sin juego).
        uniqueGames: { $size: { $setDifference: ["$gameIds", [null]] } },
      },
    },
  ]);
  if (!agg.length) {
    return {
      totalWins: 0,
      totalRated: 0,
      totalPlays: 0,
      uniqueGames: 0,
      avgDuration: null,
      firstDate: null,
      lastDate: null,
    };
  }
  const row = agg[0];
  return {
    totalWins: row.wins || 0,
    totalRated: row.rated || 0,
    totalPlays: row.totalPlays || 0,
    uniqueGames: row.uniqueGames || 0,
    avgDuration: row.avgDuration != null ? Math.round(row.avgDuration) : null,
    firstDate: row.firstDate || null,
    lastDate: row.lastDate || null,
  };
}

// Actividad diaria del usuario para el heatmap del calendario en el sidebar del
// perfil. Espeja communityActivityHeatmap (bggCommunityStats.js) pero per-user:
// agrupa BggPlay por `date` (YYYY-MM-DD) sumando `quantity`. `sinceDate` acota la
// ventana (el route pasa ~13 semanas atrás). Devuelve [{ date, count }] asc.
async function computeActivityHeatmap(
  lowerBggUsername,
  { sinceDate = null } = {},
) {
  const match = { bggUsername: lowerBggUsername, date: { $ne: null } };
  if (sinceDate) match.date.$gte = sinceDate;
  const agg = await BggPlay.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$date",
        count: { $sum: { $ifNull: ["$quantity", 1] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return agg.map((row) => ({ date: row._id, count: row.count }));
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

// Igual que computePlayedLocations pero agrupando case-insensitive y devolviendo
// una `key` estable (`l:<lower>`) por ubicación — la base de la curación
// (pestaña "Ubicaciones"). El nombre representativo es la grafía de la partida
// más reciente (mismo criterio de `$last` tras ordenar por fecha que los
// compañeros). Las dos grafías "Casa"/"casa" colapsan a una sola key.
async function computeLocationRoster(lowerBggUsername) {
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
    { $addFields: { key: { $concat: ["l:", { $toLower: "$location" }] } } },
    { $sort: { date: 1 } },
    {
      $group: {
        _id: "$key",
        name: { $last: "$location" },
        numPlays: { $sum: { $ifNull: ["$quantity", 1] } },
        lastPlayedDate: { $max: "$date" },
      },
    },
  ]);
  return agg.map((r) => ({
    key: r._id, // l:<lower>
    name: r.name,
    numPlays: r.numPlays,
    lastPlayedDate: r.lastPlayedDate || null,
  }));
}

// Stats del dueño en UNA ubicación (o varias fusionadas), derivadas de su log de
// partidas. Alimenta el detalle de la pestaña "Ubicaciones". `rawKeys`: claves de
// ubicación (`l:<lower>`, puede traer varias si está fusionada). Cuenta SESIONES
// (cada doc = 1). Devuelve `{ stats, matchedPlays }`: matchedPlays son los docs
// lean crudos ordenados (date desc, playId desc) para que el route pagine.
async function computeLocationStats(lowerBggUsername, rawKeys) {
  const set = new Set(rawKeys || []);
  const keyForPlay = (p) => `l:${(p.location || "").trim().toLowerCase()}`;

  const allPlays = await BggPlay.find({
    bggUsername: lowerBggUsername,
  }).lean();

  const matchedPlays = allPlays
    .filter((p) => (p.location || "").trim() && set.has(keyForPlay(p)))
    .sort((a, b) => {
      if (a.date !== b.date) return (b.date || "").localeCompare(a.date || "");
      return String(b.playId || "").localeCompare(String(a.playId || ""));
    });

  let total = 0;
  let firstPlayedDate = null;
  let lastPlayedDate = null;
  const byGame = new Map();
  const games = new Set();

  for (const p of matchedPlays) {
    total += 1;
    if (p.gameId) games.add(String(p.gameId));

    if (p.date) {
      if (!firstPlayedDate || p.date < firstPlayedDate)
        firstPlayedDate = p.date;
      if (!lastPlayedDate || p.date > lastPlayedDate) lastPlayedDate = p.date;
    }

    const gid = p.gameId || "?";
    const g = byGame.get(gid) || {
      gameId: p.gameId || null,
      name: p.gameName || null,
      thumbnail: p.gameThumbnail || null,
      total: 0,
    };
    g.total += 1;
    byGame.set(gid, g);
  }

  return {
    stats: {
      total,
      uniqueGames: games.size,
      firstPlayedDate,
      lastPlayedDate,
      byGame: [...byGame.values()].sort((a, b) => b.total - a.total),
    },
    matchedPlays,
  };
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

// Identidad de un jugador del roster para matchear contra el log del dueño:
// username BGG (lowercase) si existe, si no el nombre (lowercase). Espeja la
// regla de computePlayedCoPlayers. Devuelve null si no hay ni nombre ni user.
function rosterPlayerKey(p) {
  const u = (p?.username || "").trim().toLowerCase();
  if (u) return `u:${u}`;
  const n = (p?.name || "").trim().toLowerCase();
  return n ? `n:${n}` : null;
}

// Autodetección "Nuevo" para TODO el roster de una partida que se está cargando.
// Por cada jugador decide si es su primera vez con el juego, con dos señales:
//
//  1. Jugador SINCRONIZADO en TurnoCero (tiene BggPlay propios) — incluido el
//     dueño: usa SU propio historial (numPlays de ese juego === 0). Preciso.
//  2. Jugador NO sincronizado (un invitado/co-jugador del que no tenemos log
//     propio): si el dueño tiene partidas sincronizadas, se marca nuevo cuando
//     NUNCA apareció en una partida del dueño de ESE juego (primera vez que el
//     dueño lo anota jugándolo). Si el dueño no sincronizó nada, no hay con qué
//     juzgar → false (no inventamos falsos positivos).
//
// Los asientos anónimos ("Jugador anónimo N") nunca se marcan: no son una
// identidad trackeable. Devuelve un mapa { primaryKey → bool } donde primaryKey
// es `u:<username>` o `n:<name>` (lowercase), la misma clave que arma el cliente
// para cada fila del roster.
async function computeNewFlags(lowerOwner, gameId, players = []) {
  const list = Array.isArray(players) ? players : [];
  const flags = {};
  if (!list.length) return flags;
  const gid = String(gameId);

  // ¿El dueño tiene partidas sincronizadas? Gatea la heurística por invitado.
  const ownerHasPlays = !!(await BggPlay.exists({ bggUsername: lowerOwner }));

  // Usernames del roster que tienen sync propio (rama 1) + su conteo del juego.
  const usernames = [
    ...new Set(
      list.map((p) => (p.username || "").trim().toLowerCase()).filter(Boolean),
    ),
  ];
  const syncedUsernames = usernames.length
    ? await BggPlay.distinct("bggUsername", {
        bggUsername: { $in: usernames },
      })
    : [];
  const syncedSet = new Set(syncedUsernames);
  const ownCounts = new Map();
  await Promise.all(
    [...syncedSet].map(async (u) => {
      ownCounts.set(u, await computeGamePlayCount(u, gid));
    }),
  );

  // Identidades ya vistas en partidas del dueño de ESTE juego (rama 2). Una sola
  // lectura; guardamos las claves `u:` y `n:` de cada co-jugador.
  const seen = new Set();
  if (ownerHasPlays) {
    const ownerGamePlays = await BggPlay.find(
      { bggUsername: lowerOwner, gameId: gid },
      { "players.name": 1, "players.username": 1 },
    ).lean();
    for (const play of ownerGamePlays) {
      for (const pl of play.players || []) {
        const u = (pl.username || "").trim().toLowerCase();
        const n = (pl.name || "").trim().toLowerCase();
        if (u) seen.add(`u:${u}`);
        if (n) seen.add(`n:${n}`);
      }
    }
  }

  for (const p of list) {
    const key = rosterPlayerKey(p);
    if (!key) continue;
    if (isAnonymousName(p.name)) {
      flags[key] = false;
      continue;
    }
    const u = (p.username || "").trim().toLowerCase();
    const n = (p.name || "").trim().toLowerCase();
    // 1) Sincronizado en TurnoCero → su propio historial del juego.
    if (u && syncedSet.has(u)) {
      flags[key] = (ownCounts.get(u) || 0) === 0;
      continue;
    }
    // 2) No sincronizado → primera aparición en el log del dueño de ese juego.
    if (!ownerHasPlays) {
      flags[key] = false;
      continue;
    }
    const wasSeen = (u && seen.has(`u:${u}`)) || (n && seen.has(`n:${n}`));
    flags[key] = !wasSeen;
  }
  return flags;
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
    // Excluir "Jugador anónimo N": son asientos ad-hoc que no se trackean como
    // compañeros (ver services/bgg/anonymousPlayer.js). Sólo aplican a entradas
    // sin username (un usuario BGG real con ese nombre no se filtra).
    {
      $match: {
        $expr: {
          $not: {
            $and: [
              { $eq: ["$username", ""] },
              {
                $regexMatch: {
                  input: "$name",
                  regex: ANON_MONGO_REGEX,
                  options: "i",
                },
              },
            ],
          },
        },
      },
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
    .filter((p) => p.name || p.username)
    // No precargar asientos anónimos en "usar última juntada": son ad-hoc de
    // esa partida, no del roster recurrente.
    .filter((p) => p.username || !isAnonymousName(p.name));

  return {
    location: (doc.location || "").trim(),
    date: doc.date || null,
    gameName: doc.gameName || null,
    players,
  };
}

// Stats del dueño del perfil vs UN co-jugador, derivadas SOLO del log de
// partidas del dueño (a diferencia del headToHead de comunidad, que cruza los
// logs de dos miembros y exige usernames BGG en ambos). Así funciona igual para
// miembros vinculados y para jugadores cargados solo por nombre — alimenta el
// detalle de jugador en la pestaña "Jugadores".
//
// `rawKeys`: claves de identidad del co-jugador (formato `u:<user>` / `n:<name>`,
// mismo que rawKeyFor / computePlayedCoPlayers). Puede traer varias si el
// jugador está fusionado (overlay). `selfKeys`: claves que resuelven al dueño
// (loadSelfKeys) — así las victorias del dueño bajo un alias "sos vos" cuentan,
// consistente con computeGameStats. El default reproduce el caso sin curación.
//
// Cuenta SESIONES (cada doc = 1), igual que headToHead. Devuelve
// `{ stats, matchedPlays }`: matchedPlays son los docs lean crudos ordenados
// (date desc, playId desc) para que el route pagine + aplique overlay al render.
async function computeCoPlayerStats(
  lowerBggUsername,
  rawKeys,
  { selfKeys = [`u:${lowerBggUsername}`] } = {},
) {
  const coSet = new Set(rawKeys || []);
  const selfSet = new Set(selfKeys || []);

  const allPlays = await BggPlay.find({
    bggUsername: lowerBggUsername,
  }).lean();

  const matchedPlays = allPlays
    .filter((p) => (p.players || []).some((pl) => coSet.has(rawKeyFor(pl))))
    .sort((a, b) => {
      if (a.date !== b.date) return (b.date || "").localeCompare(a.date || "");
      return String(b.playId || "").localeCompare(String(a.playId || ""));
    });

  let ownerWins = 0;
  let playerWins = 0;
  let draws = 0;
  let firstPlayedDate = null;
  let lastPlayedDate = null;
  const byGame = new Map();

  for (const p of matchedPlays) {
    const players = p.players || [];
    const ownerWin = players.some(
      (pl) => selfSet.has(rawKeyFor(pl)) && pl.win === true,
    );
    const playerWin = players.some(
      (pl) => coSet.has(rawKeyFor(pl)) && pl.win === true,
    );
    const ownerOnly = ownerWin && !playerWin;
    const playerOnly = playerWin && !ownerWin;
    if (ownerOnly) ownerWins += 1;
    else if (playerOnly) playerWins += 1;
    else draws += 1;

    if (p.date) {
      if (!firstPlayedDate || p.date < firstPlayedDate)
        firstPlayedDate = p.date;
      if (!lastPlayedDate || p.date > lastPlayedDate) lastPlayedDate = p.date;
    }

    const gid = p.gameId || "?";
    const g = byGame.get(gid) || {
      gameId: p.gameId || null,
      name: p.gameName || null,
      thumbnail: p.gameThumbnail || null,
      total: 0,
      ownerWins: 0,
      playerWins: 0,
    };
    g.total += 1;
    if (ownerOnly) g.ownerWins += 1;
    else if (playerOnly) g.playerWins += 1;
    byGame.set(gid, g);
  }

  return {
    stats: {
      total: matchedPlays.length,
      ownerWins,
      playerWins,
      draws,
      firstPlayedDate,
      lastPlayedDate,
      byGame: [...byGame.values()].sort((a, b) => b.total - a.total),
    },
    matchedPlays,
  };
}

// Partidas del dueño con EXACTAMENTE el mismo grupo de jugadores que una
// partida dada (roster idéntico como conjunto, sin importar orden ni asientos
// vacíos). La identidad de cada integrante es su clave canónica: si la rawKey
// (`u:`/`n:`, ver rawKeyFor) está reclamada por un overlay (fusión/alias de
// curación), identifica el overlay (`o:<id>`) — así una partida donde el mismo
// humano aparece bajo un alias fusionado matchea igual. Sin overlayIndex cae a
// la rawKey pura.
//
// Devuelve null si la partida no existe. `matchedPlays` INCLUYE la partida de
// referencia (orden date desc, playId desc — memory: feedback-mongo-latest-
// tiebreak no aplica acá porque playId desc ya desempata): los totales leen
// mejor incluyéndola ("jugaron juntos N veces"); el caller decide si la
// excluye del listado.
async function computeGroupStats(
  lowerBggUsername,
  playId,
  { overlayIndex = null } = {},
) {
  const target = await BggPlay.findOne({
    bggUsername: lowerBggUsername,
    playId: String(playId),
  }).lean();
  if (!target) return null;

  const canonicalKey = (pl) => {
    const key = rawKeyFor(pl);
    const overlay = overlayIndex?.byKey?.get(key);
    return overlay ? `o:${overlay._id}` : `k:${key}`;
  };
  const rosterOf = (play) => {
    const set = new Set();
    for (const pl of play.players || []) {
      if (!(pl.name || "").trim() && !(pl.username || "").trim()) continue;
      set.add(canonicalKey(pl));
    }
    return set;
  };

  const targetRoster = rosterOf(target);
  const allPlays = await BggPlay.find({ bggUsername: lowerBggUsername }).lean();
  const matchedPlays = allPlays
    .filter((p) => {
      const roster = rosterOf(p);
      if (roster.size !== targetRoster.size) return false;
      for (const k of roster) if (!targetRoster.has(k)) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.date !== b.date) return (b.date || "").localeCompare(a.date || "");
      return String(b.playId || "").localeCompare(String(a.playId || ""));
    });

  // Victorias por integrante + juegos jugados por el grupo. Cuenta SESIONES
  // (cada doc = 1), igual que computeCoPlayerStats.
  const winsByKey = new Map([...targetRoster].map((k) => [k, 0]));
  let firstPlayedDate = null;
  let lastPlayedDate = null;
  const byGame = new Map();
  for (const p of matchedPlays) {
    const winnerKeys = new Set(
      (p.players || []).filter((pl) => pl.win === true).map(canonicalKey),
    );
    for (const k of winnerKeys) {
      if (winsByKey.has(k)) winsByKey.set(k, winsByKey.get(k) + 1);
    }
    if (p.date) {
      if (!firstPlayedDate || p.date < firstPlayedDate)
        firstPlayedDate = p.date;
      if (!lastPlayedDate || p.date > lastPlayedDate) lastPlayedDate = p.date;
    }
    const gid = p.gameId || "?";
    const g = byGame.get(gid) || {
      gameId: p.gameId || null,
      name: p.gameName || null,
      thumbnail: p.gameThumbnail || null,
      total: 0,
    };
    g.total += 1;
    byGame.set(gid, g);
  }

  // Roster con victorias: una fila por integrante, representada por su asiento
  // en la partida de referencia (el route le aplica el overlay para que los
  // nombres curados ganen, igual que en los players de cada play).
  const seen = new Set();
  const roster = [];
  for (const pl of target.players || []) {
    const key = canonicalKey(pl);
    if (!winsByKey.has(key) || seen.has(key)) continue;
    seen.add(key);
    roster.push({
      key,
      name: (pl.name || "").trim(),
      username: (pl.username || "").trim(),
      wins: winsByKey.get(key),
    });
  }
  roster.sort((a, b) => b.wins - a.wins);

  return {
    stats: {
      total: matchedPlays.length,
      firstPlayedDate,
      lastPlayedDate,
      byGame: [...byGame.values()].sort((a, b) => b.total - a.total),
    },
    roster,
    matchedPlays,
  };
}

module.exports = {
  computeGameStats,
  computeOverallStats,
  computeActivityHeatmap,
  computeCoPlayerStats,
  computeLastJuntada,
  computePlayedGames,
  computePlayedGamesWithRecency,
  mergeUserGameList,
  computeTopPlayedGame,
  computePlayedLocations,
  computeLocationRoster,
  computeLocationStats,
  computeGamePlayCount,
  computeNewFlags,
  rosterPlayerKey,
  computePlayedCoPlayers,
  computeGroupStats,
};
