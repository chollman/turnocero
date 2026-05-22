// Business logic de torneos extraída del router. Antes estos helpers
// vivían como funciones top-level en `routes/torneos.js` (1657 líneas),
// mezclados con HTTP plumbing — difíciles de testear sin armar
// request/response mocks. Acá quedan como funciones puras-ish (tocan
// Mongo pero no Express) con dependencias inyectables o requeridas
// internamente.

const TorneoMatch = require("../models/TorneoMatch");
const TorneoGroup = require("../models/TorneoGroup");
const TorneoGame = require("../models/TorneoGame");
const {
  generateLeagueFixture,
  generateSingleElimBracket,
  generateGroupsPhase,
} = require("../utils/tournamentGeneration");

// State transitions allowed.
// Note: `draft → in_progress` is only valid for
// `inscriptionMode === 'admin_only'` (validación de esa restricción se
// hace en el handler, no acá — el shape de la tabla es más libre).
const VALID_TRANSITIONS = {
  draft: new Set(["registration", "in_progress"]),
  registration: new Set(["in_progress", "draft"]),
  in_progress: new Set(["finished"]),
  finished: new Set([]),
};

// Genera e inserta los documents de match para un torneo (formato
// 'league' o 'single_elim'), después patchea las refs `nextMatch` para
// single_elim. Tira si no se pudo generar nada (e.g. faltan
// participantes).
//
// Retorna el array de matches insertados (con `_id` real).
async function buildAndInsertMatches(torneo) {
  const ids = torneo.participants.map((p) => p._id || p);
  const raw =
    torneo.format === "league"
      ? generateLeagueFixture(ids)
      : generateSingleElimBracket(ids);

  if (raw.length === 0) {
    throw new Error(
      "No se pudieron generar los partidos: faltan participantes.",
    );
  }

  // Primera pasada — inserción sin refs `nextMatch`.
  const docs = raw.map((m) => ({
    torneo: torneo._id,
    round: m.round,
    matchIndex: m.matchIndex,
    playerA: m.playerA || null,
    playerB: m.playerB || null,
    isUpperSlot: m.isUpperSlot ?? true,
    winner: m.winner || null,
    status: m.status,
    playedAt: m.playedAt || null,
  }));
  const inserted = await TorneoMatch.insertMany(docs);

  // Segunda pasada solo para single_elim — resolver refs cruzadas
  // (round, matchIndex → _id real del doc parent).
  if (torneo.format === "single_elim") {
    const byKey = new Map(
      inserted.map((doc) => [`${doc.round}-${doc.matchIndex}`, doc]),
    );
    const ops = [];
    raw.forEach((m, idx) => {
      if (!m.nextMatchKey) return;
      const next = byKey.get(m.nextMatchKey);
      if (!next) return;
      ops.push({
        updateOne: {
          filter: { _id: inserted[idx]._id },
          update: { $set: { nextMatch: next._id } },
        },
      });
    });
    if (ops.length > 0) await TorneoMatch.bulkWrite(ops);
  }

  return inserted;
}

// Construye los grupos + games para la fase indicada de un torneo
// format='groups'. `tableSizeOverride` permite cambiar el tamaño de la
// mesa para una fase específica (caso "cuartos de final con mesas de 5",
// por ejemplo).
async function buildAndInsertGroupsForPhase(
  torneo,
  phaseNumber,
  playerIds,
  tableSizeOverride,
) {
  const tableSize = tableSizeOverride ?? torneo.tableSize;
  const layout = generateGroupsPhase(playerIds, tableSize);
  if (layout.length === 0) throw new Error("No se pudieron armar los grupos.");

  const groupDocs = layout.map((g) => ({
    torneo: torneo._id,
    phase: phaseNumber,
    tableNumber: g.tableNumber,
    players: g.players,
    advancedPlayers: [],
    status: "in_progress",
  }));
  const insertedGroups = await TorneoGroup.insertMany(groupDocs);

  // Insert games (P por grupo).
  const gameDocs = [];
  for (const group of insertedGroups) {
    for (let n = 1; n <= torneo.gamesPerGroup; n++) {
      gameDocs.push({
        torneo: torneo._id,
        group: group._id,
        gameNumber: n,
        results: [],
        status: "pending",
      });
    }
  }
  if (gameDocs.length > 0) await TorneoGame.insertMany(gameDocs);

  return insertedGroups;
}

// Cuando se deshace un resultado en single_elim, hay que limpiar el
// winner del match Y propagar hacia los matches hijos (porque ese winner
// fue puesto en uno de los slots del próximo match — el "playerA" o
// "playerB" según `isUpperSlot`).
//
// Recursivo: si el child también había completado y dependía del slot
// que estamos limpiando, también se invalida.
async function cascadeClearWinner(matchId, slotKey /* 'playerA' | 'playerB' */) {
  const match = await TorneoMatch.findById(matchId);
  if (!match) return;
  // Capturamos el winner antes de tocar el slot — sino perdemos quién
  // hay que limpiar en el child.
  const wasWinner = match.winner ? String(match.winner) : null;
  match[slotKey] = null;
  // Si el match ya estaba completed y dependía del slot que estamos
  // anulando, también se invalida.
  if (match.status === "completed" && wasWinner) {
    match.winner = null;
    match.isDraw = false;
    match.status = "pending";
    match.playedAt = null;
  }
  await match.save();

  if (match.nextMatch && wasWinner) {
    const child = await TorneoMatch.findById(match.nextMatch);
    if (!child) return;
    const childSlot = match.isUpperSlot ? "playerA" : "playerB";
    if (child[childSlot] && String(child[childSlot]) === wasWinner) {
      await cascadeClearWinner(child._id, childSlot);
    }
  }
}

// Devuelve el número de round más alto que tiene matches en este torneo.
// Usado por single_elim para detectar la "final" sin tener que saber
// cuántos rounds había de antemano.
async function getFinalRound(torneoId) {
  const last = await TorneoMatch.findOne({ torneo: torneoId })
    .sort({ round: -1 })
    .select("round")
    .lean();
  return last?.round || 0;
}

module.exports = {
  VALID_TRANSITIONS,
  buildAndInsertMatches,
  buildAndInsertGroupsForPhase,
  cascadeClearWinner,
  getFinalRound,
};
