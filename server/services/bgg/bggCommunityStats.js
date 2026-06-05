// Aggregations CROSS-USER sobre `BggPlay` — la base del "hub de comunidad"
// de BG Watch. A diferencia de bggAggregations.js (todo per-user, scopeado a
// un único bggUsername), acá las queries barren las partidas de TODA la
// comunidad para derivar rankings de juegos/jugadores, win-rates globales,
// head-to-head y feed de actividad.
//
// REGLAS DEL DOMINIO (todas con memoria asociada):
//
// - Preferir `BggPlay` sobre `BggCollection` (memory:
//   feedback-bgg-prefer-plays-aggregation). La colección omite juegos no-
//   poseídos y queda vacía con perfiles privados. Solo gameOwners() toca la
//   colección, y con disclaimer de incompletitud.
//
// - Case mismatch (memory: feedback-bgg-username-case): `BggPlay.bggUsername`
//   es lowercase, `User.bggUsername` es case-preserved. Todo cruce entre
//   modelos usa `collation strength: 2`. El caller pasa usernames en lowercase.
//
// - `players[].score` es String → convertir con guarda (onError/onNull null)
//   antes de promediar. `players[].name` puede ser null → excluido.
//
// - Doble-conteo: una misma mesa física suele loguearse por varios miembros
//   (cada uno registra su propia partida con la mesa entera). Para rankings de
//   jugadores se cuenta la partida de cada logger (limpio: 1 doc = 1 logger).
//   Para "total de plays de un juego" se suma por logger y se expone ADEMÁS
//   "miembros distintos" (`playerCount`) como métrica honesta.
//
// MULTI-TENANCY (fase 2): cada función acepta un `bggUsernames` opcional
// (allowlist en lowercase). En global queda null/undefined (sin filtro). Para
// scopear por Comunidad, el caller computa los bggUsername de los miembros de
// la comunidad activa y los pasa — mismo código, distinto scope. Es la única
// costura que hace falta.

const BggPlay = require("../../models/BggPlay");
const BggCollection = require("../../models/BggCollection");
const User = require("../../models/User");
const { resolveGamesBatch } = require("./bggResolve");
const { computePlayedCoPlayers } = require("./bggAggregations");

// Expresión $reduce reutilizable: dado un doc de BggPlay, resuelve si el
// LOGGER (su propio bggUsername) ganó esa partida. Devuelve true/false si se
// encontró a sí mismo en `players`, o null si no aparece. Usada por
// gameCommunityStats y communityWinRates.
const OWNER_WIN_REDUCE = {
  $reduce: {
    input: { $ifNull: ["$players", []] },
    initialValue: null,
    in: {
      $cond: [
        {
          $eq: [
            { $toLower: { $ifNull: ["$$this.username", ""] } },
            "$bggUsername",
          ],
        },
        { $eq: ["$$this.win", true] },
        "$$value",
      ],
    },
  },
};

// ── Helpers de identidad ──────────────────────────────────────────────────

// Batch lookup bggUsername (lowercase) → User para avatares/links en rankings.
// Equivalente server-side del hook cliente useBggUserMap. Devuelve un Map
// keyed por el username LOWERCASE (para matchear contra BggPlay.bggUsername),
// con `{ _id, username, displayName, avatar }`. Usa collation strength 2 para
// matchear el `User.bggUsername` case-preserved contra la lista lowercase.
async function resolveBggUsernamesToUsers(lowerUsernames = []) {
  const list = [...new Set((lowerUsernames || []).filter(Boolean))];
  const map = new Map();
  if (!list.length) return map;

  const users = await User.find({ bggUsername: { $in: list } })
    .collation({ locale: "en", strength: 2 })
    .select("username displayName avatar bggUsername")
    .lean();

  for (const u of users) {
    if (!u.bggUsername) continue;
    map.set(u.bggUsername.toLowerCase(), {
      _id: u._id,
      username: u.username,
      displayName: u.displayName || "",
      avatar: u.avatar || null,
    });
  }
  return map;
}

// El set de "la comunidad": todo User con un bggUsername conectado, en
// lowercase y deduplicado. Las aggregations sobre BggPlay ya solo contienen
// miembros sincronizados, pero esto permite restringir explícito (gameOwners)
// y es la fuente para el filtro `bggUsernames` por comunidad en fase 2.
async function connectedMemberUsernames() {
  const docs = await User.find({ bggUsername: { $type: "string", $ne: "" } })
    .select("bggUsername")
    .lean();
  return [
    ...new Set(
      docs.map((d) => (d.bggUsername || "").toLowerCase()).filter(Boolean),
    ),
  ];
}

// ── Fase 1: Top juegos de la comunidad ────────────────────────────────────

// Juegos más jugados de la comunidad. `totalPlays` suma `quantity` de cada
// play (doble-cuenta sesiones compartidas, ver header); `playerCount` =
// miembros distintos que loguearon ese juego (métrica honesta). Con
// `sinceDate` (string YYYY-MM-DD) filtra a un período → "en llamas".
async function topCommunityGames({
  limit = 12,
  sinceDate = null,
  bggUsernames = null,
} = {}) {
  const match = { gameId: { $ne: null } };
  if (sinceDate) match.date = { $gte: sinceDate };
  if (bggUsernames) match.bggUsername = { $in: bggUsernames };

  const agg = await BggPlay.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$gameId",
        totalPlays: { $sum: { $ifNull: ["$quantity", 1] } },
        members: { $addToSet: "$bggUsername" },
        name: { $last: "$gameName" },
        thumbnail: { $last: "$gameThumbnail" },
        lastPlayedDate: { $max: "$date" },
      },
    },
    {
      $project: {
        totalPlays: 1,
        name: 1,
        thumbnail: 1,
        lastPlayedDate: 1,
        playerCount: { $size: "$members" },
      },
    },
    // Desempate por _id para orden estable con totalPlays empatados.
    { $sort: { totalPlays: -1, playerCount: -1, _id: 1 } },
    { $limit: Math.max(1, limit) },
  ]);

  const gamesMap = await resolveGamesBatch(agg.map((r) => r._id));
  return agg.map((r) => {
    const g = gamesMap.get(Number(r._id));
    return {
      id: r._id,
      name: r.name || g?.name || null,
      thumbnail: r.thumbnail || g?.thumbnail || null,
      image: g?.image || null,
      totalPlays: r.totalPlays,
      playerCount: r.playerCount,
      lastPlayedDate: r.lastPlayedDate || null,
    };
  });
}

// Stats de UN juego a nivel comunidad: total plays, miembros distintos,
// win-rate de comunidad (sobre la victoria del logger en cada play),
// duración y score promedio, y ranking de quién lo jugó más (resuelto a
// Users). Un solo $facet para no barrer la colección tres veces.
async function gameCommunityStats(gameId, { bggUsernames = null } = {}) {
  const match = { gameId: String(gameId) };
  if (bggUsernames) match.bggUsername = { $in: bggUsernames };

  const facet = await BggPlay.aggregate([
    { $match: match },
    {
      $facet: {
        summary: [
          {
            $project: {
              bggUsername: 1,
              quantity: { $ifNull: ["$quantity", 1] },
              duration: 1,
              // win del logger en esta play (null si no se encontró a sí mismo).
              ownerWin: OWNER_WIN_REDUCE,
            },
          },
          {
            $group: {
              _id: null,
              totalPlays: { $sum: "$quantity" },
              members: { $addToSet: "$bggUsername" },
              wins: { $sum: { $cond: [{ $eq: ["$ownerWin", true] }, 1, 0] } },
              decided: {
                $sum: { $cond: [{ $ne: ["$ownerWin", null] }, 1, 0] },
              },
              avgDuration: {
                $avg: { $cond: [{ $gt: ["$duration", 0] }, "$duration", null] },
              },
            },
          },
        ],
        topPlayers: [
          {
            $group: {
              _id: "$bggUsername",
              numPlays: { $sum: { $ifNull: ["$quantity", 1] } },
            },
          },
          { $sort: { numPlays: -1, _id: 1 } },
          { $limit: 10 },
        ],
        scores: [
          { $unwind: "$players" },
          {
            $project: {
              score: {
                $convert: {
                  input: "$players.score",
                  to: "double",
                  onError: null,
                  onNull: null,
                },
              },
            },
          },
          { $match: { score: { $ne: null } } },
          {
            $group: {
              _id: null,
              avgScore: { $avg: "$score" },
              maxScore: { $max: "$score" },
            },
          },
        ],
      },
    },
  ]);

  const s = facet[0]?.summary?.[0] || null;
  const sc = facet[0]?.scores?.[0] || null;
  const topRows = facet[0]?.topPlayers || [];

  const userMap = await resolveBggUsernamesToUsers(topRows.map((r) => r._id));
  const topPlayers = topRows.map((r) => ({
    bggUsername: r._id,
    numPlays: r.numPlays,
    user: userMap.get(r._id) || null,
  }));

  return {
    totalPlays: s?.totalPlays || 0,
    memberCount: s?.members?.length || 0,
    wins: s?.wins || 0,
    decided: s?.decided || 0,
    winRate: s && s.decided > 0 ? s.wins / s.decided : null,
    avgDuration: s?.avgDuration != null ? Math.round(s.avgDuration) : null,
    avgScore: sc?.avgScore != null ? Math.round(sc.avgScore * 100) / 100 : null,
    maxScore: sc?.maxScore != null ? sc.maxScore : null,
    topPlayers,
  };
}

// Miembros que POSEEN un juego (de BggCollection). CAVEAT: la colección omite
// perfiles privados y juegos no-poseídos, así que esta lista es un piso, no
// exhaustiva — la UI lo aclara. El caller DEBE pasar `bggUsernames` = set de
// miembros para no devolver colecciones de usernames mirados que no son
// miembros (la colección se materializa para cualquier lookup público).
async function gameOwners(gameId, { bggUsernames = null } = {}) {
  const match = { "games.id": String(gameId) };
  if (bggUsernames) match.bggUsername = { $in: bggUsernames };

  const docs = await BggCollection.find(match).select("bggUsername").lean();
  const usernames = docs.map((d) => d.bggUsername);
  const userMap = await resolveBggUsernamesToUsers(usernames);
  return usernames.map((u) => ({
    bggUsername: u,
    user: userMap.get(u) || null,
  }));
}

// ── Fase 2: Leaderboards de jugadores ─────────────────────────────────────

// Ranking de miembros por métrica. `metric`: "plays" (suma de quantity) o
// "variedad" (juegos únicos). Cada doc de BggPlay es 1 logger ⇒ sin doble-
// conteo de sesiones compartidas. `sinceDate` acota a un período (ej. inicio
// de mes para "jugador del mes").
async function communityPlayerLeaderboard({
  metric = "plays",
  sinceDate = null,
  bggUsernames = null,
  limit = 20,
} = {}) {
  const match = {};
  if (sinceDate) match.date = { $gte: sinceDate };
  if (bggUsernames) match.bggUsername = { $in: bggUsernames };

  const agg = await BggPlay.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$bggUsername",
        totalPlays: { $sum: { $ifNull: ["$quantity", 1] } },
        games: { $addToSet: "$gameId" },
        lastDate: { $max: "$date" },
      },
    },
    {
      $project: {
        totalPlays: 1,
        lastDate: 1,
        // Excluir gameId null del conteo de variedad.
        uniqueGames: { $size: { $setDifference: ["$games", [null]] } },
      },
    },
  ]);

  const sortKey = metric === "variedad" ? "uniqueGames" : "totalPlays";
  agg.sort(
    (a, b) =>
      b[sortKey] - a[sortKey] ||
      b.totalPlays - a.totalPlays ||
      a._id.localeCompare(b._id),
  );
  const top = agg.slice(0, Math.max(1, limit));
  const userMap = await resolveBggUsernamesToUsers(top.map((r) => r._id));
  return top.map((r) => ({
    bggUsername: r._id,
    totalPlays: r.totalPlays,
    uniqueGames: r.uniqueGames,
    lastDate: r.lastDate || null,
    user: userMap.get(r._id) || null,
  }));
}

// Win-rate por miembro sobre SUS propias partidas (donde aparece y ganó).
// `minPlays` filtra a quienes tienen suficientes partidas decididas para que
// el ratio sea justo. `decided` = partidas donde el logger figura en players.
async function communityWinRates({
  minPlays = 5,
  bggUsernames = null,
  limit = 20,
} = {}) {
  const match = {};
  if (bggUsernames) match.bggUsername = { $in: bggUsernames };

  const agg = await BggPlay.aggregate([
    { $match: match },
    { $project: { bggUsername: 1, ownerWin: OWNER_WIN_REDUCE } },
    { $match: { ownerWin: { $ne: null } } },
    {
      $group: {
        _id: "$bggUsername",
        decided: { $sum: 1 },
        wins: { $sum: { $cond: [{ $eq: ["$ownerWin", true] }, 1, 0] } },
      },
    },
    { $match: { decided: { $gte: minPlays } } },
  ]);

  const rows = agg
    .map((r) => ({ ...r, winRate: r.wins / r.decided }))
    .sort(
      (a, b) =>
        b.winRate - a.winRate ||
        b.decided - a.decided ||
        a._id.localeCompare(b._id),
    )
    .slice(0, Math.max(1, limit));

  const userMap = await resolveBggUsernamesToUsers(rows.map((r) => r._id));
  return rows.map((r) => ({
    bggUsername: r._id,
    wins: r.wins,
    decided: r.decided,
    winRate: r.winRate,
    user: userMap.get(r._id) || null,
  }));
}

// Racha de SEMANAS consecutivas con al menos una partida. Función PURA
// (testeable sin Mongo): mapea cada fecha a su lunes (semana ISO-ish, UTC),
// deduplica, ordena, y cuenta la corrida más larga de semanas a 7 días de
// distancia. Para board games la racha diaria es casi siempre 1 — la semanal
// es la métrica con sentido.
function weekStartMs(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=Dom .. 6=Sáb
  const shift = day === 0 ? -6 : 1 - day; // mover al lunes
  d.setUTCDate(d.getUTCDate() + shift);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function longestWeekStreak(dates = []) {
  const WEEK = 7 * 24 * 3600 * 1000;
  const weeks = [...new Set(dates.filter(Boolean).map(weekStartMs))].sort(
    (a, b) => a - b,
  );
  if (!weeks.length) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < weeks.length; i += 1) {
    if (weeks[i] - weeks[i - 1] === WEEK) {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 1;
    }
  }
  return best;
}

// Leaderboard de rachas semanales de la comunidad.
async function communityStreaks({ bggUsernames = null, limit = 20 } = {}) {
  const match = { date: { $ne: null } };
  if (bggUsernames) match.bggUsername = { $in: bggUsernames };

  const agg = await BggPlay.aggregate([
    { $match: match },
    { $group: { _id: "$bggUsername", dates: { $addToSet: "$date" } } },
  ]);

  const rows = agg
    .map((r) => ({
      bggUsername: r._id,
      weekStreak: longestWeekStreak(r.dates),
    }))
    .filter((r) => r.weekStreak > 0)
    .sort(
      (a, b) =>
        b.weekStreak - a.weekStreak ||
        a.bggUsername.localeCompare(b.bggUsername),
    )
    .slice(0, Math.max(1, limit));

  const userMap = await resolveBggUsernamesToUsers(
    rows.map((r) => r.bggUsername),
  );
  return rows.map((r) => ({ ...r, user: userMap.get(r.bggUsername) || null }));
}

// ── Fase 3: Grafo social / Head-to-head ───────────────────────────────────

// Top compañeros de un usuario (con quién jugó más). Reusa la aggregation
// per-user computePlayedCoPlayers (que ya deduplica por username/nombre y
// excluye al dueño) y enriquece con el User de TurnoCero cuando el compañero
// es miembro. Los no-miembros (o jugadores sin username BGG) quedan con
// `user: null` y se muestran por nombre.
async function topCoPlayers(lowerBggUsername, { limit = 12 } = {}) {
  const all = await computePlayedCoPlayers(lowerBggUsername);
  all.sort(
    (a, b) =>
      b.numPlays - a.numPlays ||
      (b.lastPlayedDate || "").localeCompare(a.lastPlayedDate || ""),
  );
  const top = all.slice(0, Math.max(1, limit));
  const userMap = await resolveBggUsernamesToUsers(
    top.map((c) => (c.username || "").toLowerCase()).filter(Boolean),
  );
  return top.map((c) => ({
    name: c.name,
    username: c.username,
    numPlays: c.numPlays,
    lastPlayedDate: c.lastPlayedDate,
    user: c.username ? userMap.get(c.username.toLowerCase()) || null : null,
  }));
}

// Head-to-head entre dos miembros. Toma las partidas logueadas por A o por B
// donde AMBOS figuran en `players` (case-insensitive), deduplica la sesión
// compartida (cada uno la loguea por separado con distinto playId) por firma
// fecha|juego|jugadores, y talla victorias de cada uno + desglose por juego.
// CAVEAT: una sesión logueada SOLO por un tercero no aparece — el récord sale
// de los logs propios de A/B, que es la fuente canónica.
async function headToHead(lowerA, lowerB) {
  const plays = await BggPlay.aggregate([
    { $match: { bggUsername: { $in: [lowerA, lowerB] } } },
    {
      $addFields: {
        unames: {
          $map: {
            input: { $ifNull: ["$players", []] },
            as: "p",
            in: { $toLower: { $ifNull: ["$$p.username", ""] } },
          },
        },
      },
    },
    {
      $match: {
        $expr: {
          $and: [{ $in: [lowerA, "$unames"] }, { $in: [lowerB, "$unames"] }],
        },
      },
    },
  ]);

  const seen = new Map();
  for (const play of plays) {
    const sig = `${play.date}|${play.gameId}|${[...play.unames].sort().join(",")}`;
    if (!seen.has(sig)) seen.set(sig, play);
  }

  let aWins = 0;
  let bWins = 0;
  let draws = 0;
  const byGame = new Map();

  for (const play of seen.values()) {
    const find = (lower) =>
      (play.players || []).find(
        (p) => (p.username || "").toLowerCase() === lower,
      );
    const aw = find(lowerA)?.win === true;
    const bw = find(lowerB)?.win === true;
    if (aw && !bw) aWins += 1;
    else if (bw && !aw) bWins += 1;
    else draws += 1;

    const key = play.gameId || "?";
    const g = byGame.get(key) || {
      gameId: play.gameId || null,
      name: play.gameName || null,
      thumbnail: play.gameThumbnail || null,
      total: 0,
      aWins: 0,
      bWins: 0,
    };
    g.total += 1;
    if (aw && !bw) g.aWins += 1;
    else if (bw && !aw) g.bWins += 1;
    byGame.set(key, g);
  }

  const userMap = await resolveBggUsernamesToUsers([lowerA, lowerB]);
  return {
    total: seen.size,
    aWins,
    bWins,
    draws,
    userA: { bggUsername: lowerA, user: userMap.get(lowerA) || null },
    userB: { bggUsername: lowerB, user: userMap.get(lowerB) || null },
    byGame: [...byGame.values()].sort((a, b) => b.total - a.total),
  };
}

// ── Fase 4: Feed de actividad + insights personales ───────────────────────

// Feed de partidas recientes de la comunidad, paginado. Orden date desc,
// _id desc (desempate por _id, memory: feedback-mongo-latest-tiebreak — con
// fechas string empatadas el _id monótono rompe el empate al insertado
// último). Enriquece logger + players con Users de TurnoCero.
async function communityActivityFeed({
  page = 1,
  limit = 20,
  bggUsernames = null,
} = {}) {
  const match = {};
  if (bggUsernames) match.bggUsername = { $in: bggUsernames };

  const total = await BggPlay.countDocuments(match);
  const safeLimit = Math.max(1, limit);
  const safePage = Math.max(1, page);
  const docs = await BggPlay.find(match)
    .sort({ date: -1, _id: -1 })
    .skip((safePage - 1) * safeLimit)
    .limit(safeLimit)
    .lean();

  // Resolver en un solo batch: el logger de cada play + los players con
  // username BGG.
  const usernames = new Set();
  for (const d of docs) {
    if (d.bggUsername) usernames.add(d.bggUsername.toLowerCase());
    for (const p of d.players || []) {
      if (p.username) usernames.add(p.username.toLowerCase());
    }
  }
  const userMap = await resolveBggUsernamesToUsers([...usernames]);

  const items = docs.map((d) => ({
    id: d.playId,
    bggUsername: d.bggUsername,
    logger: userMap.get((d.bggUsername || "").toLowerCase()) || null,
    date: d.date,
    gameId: d.gameId,
    gameName: d.gameName,
    gameThumbnail: d.gameThumbnail,
    quantity: d.quantity,
    location: d.location,
    players: (d.players || []).map((p) => ({
      name: p.name,
      username: p.username,
      win: p.win,
      score: p.score,
      user: p.username ? userMap.get(p.username.toLowerCase()) || null : null,
    })),
  }));

  return {
    items,
    total,
    page: safePage,
    pages: Math.ceil(total / safeLimit) || 1,
  };
}

// Conteo de partidas por día (para un heatmap de calendario). `sinceDate`
// acota la ventana (ej. último año).
async function communityActivityHeatmap({
  sinceDate = null,
  bggUsernames = null,
} = {}) {
  const match = { date: { $ne: null } };
  if (sinceDate) match.date = { $ne: null, $gte: sinceDate };
  if (bggUsernames) match.bggUsername = { $in: bggUsernames };

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
  return agg.map((r) => ({ date: r._id, count: r.count }));
}

// Posición/percentil de un usuario en un juego dentro de la comunidad (por
// cantidad de partidas). Para inyectar "sos el #3 en Wingspan" en el perfil.
// Devuelve null si el usuario no tiene partidas de ese juego.
async function playerGameRank(
  lowerBggUsername,
  gameId,
  { bggUsernames = null } = {},
) {
  const match = { gameId: String(gameId) };
  if (bggUsernames) match.bggUsername = { $in: bggUsernames };

  const agg = await BggPlay.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$bggUsername",
        numPlays: { $sum: { $ifNull: ["$quantity", 1] } },
      },
    },
    { $sort: { numPlays: -1, _id: 1 } },
  ]);

  const idx = agg.findIndex((r) => r._id === lowerBggUsername);
  if (idx === -1) return null;
  return { rank: idx + 1, total: agg.length, numPlays: agg[idx].numPlays };
}

module.exports = {
  resolveBggUsernamesToUsers,
  connectedMemberUsernames,
  topCommunityGames,
  gameCommunityStats,
  gameOwners,
  communityPlayerLeaderboard,
  communityWinRates,
  longestWeekStreak,
  communityStreaks,
  topCoPlayers,
  headToHead,
  communityActivityFeed,
  communityActivityHeatmap,
  playerGameRank,
};
