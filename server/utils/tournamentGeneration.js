/**
 * Tournament fixture / bracket generation helpers.
 *
 * All functions take an array of participant IDs (in seed order) and return
 * a list of plain match objects { round, matchIndex, playerA, playerB,
 * nextMatchKey?, isUpperSlot?, status }.
 *
 * The route layer is responsible for inserting these into MongoDB and
 * patching `nextMatch` ObjectId refs (using `nextMatchKey` to find peers).
 */

/**
 * Round-robin schedule using the circle method.
 * If n is odd, a "BYE" placeholder is inserted; matches paired with BYE
 * become `status: 'bye'` and have `playerB = null`.
 */
function generateLeagueFixture(participantIds) {
  const players = [...participantIds];
  if (players.length < 2) return [];

  const hasBye = players.length % 2 === 1;
  if (hasBye) players.push(null); // BYE marker

  const n = players.length;
  const rounds = n - 1;
  const half = n / 2;

  const matches = [];
  // The first player stays fixed; the rest rotate.
  let rotating = players.slice(1);

  for (let r = 0; r < rounds; r++) {
    const arrangement = [players[0], ...rotating];
    for (let i = 0; i < half; i++) {
      const a = arrangement[i];
      const b = arrangement[n - 1 - i];

      // Alternate home/away by round to balance, but does not affect logic.
      const swap = r % 2 === 1 && i === 0;
      const pa = swap ? b : a;
      const pb = swap ? a : b;

      const isBye = pa === null || pb === null;
      matches.push({
        round: r + 1,
        matchIndex: i,
        playerA: pa,
        playerB: pb,
        status: isBye ? 'bye' : 'pending',
        winner: isBye ? (pa || pb) : null,
        playedAt: isBye ? new Date() : null,
      });
    }
    // Rotate: take last, move to front of rotating list.
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, rotating.length - 1)];
  }

  return matches;
}

/**
 * Single-elimination bracket sized to the actual player count.
 *
 * Instead of padding to the next power of 2 with byes, we use a **preliminary
 * (play-in) round** so that the main bracket has exactly the largest power of 2
 * ≤ N players, and the extras play in first.
 *
 * Examples:
 *   N=4  → main=4, no play-in: 2 R1 + 1 final = 3 matches in 2 rounds.
 *   N=5  → main=4, 1 play-in:  1 prelim + 2 R1 + 1 final = 4 matches in 3 rounds.
 *   N=10 → main=8, 2 play-in:  2 prelim + 4 QF + 2 SF + 1 final = 9 matches in 4 rounds.
 *
 * Round 1 is always the play-in round (if any). Main bracket starts at round 2
 * when there is a play-in; otherwise it starts at round 1.
 *
 * Returns a flat list of matches with `nextMatchKey` (round-matchIndex string)
 * and `isUpperSlot` so the route can resolve ObjectId refs after insertion.
 */
function generateSingleElimBracket(participantIds) {
  const n = participantIds.length;
  if (n < 2) return [];

  const mainSize    = highestPowerOfTwoLE(n);
  const playInCount = n - mainSize;            // # of play-in matches
  const mainRounds  = Math.log2(mainSize);
  const hasPlayIn   = playInCount > 0;
  const roundOffset = hasPlayIn ? 1 : 0;       // shift main rounds by 1 when there's play-in

  // # seeds that bypass play-in and enter main bracket directly:
  // directSeeds + 2 * playInCount = n  →  directSeeds = 2 * mainSize - n
  const directSeeds = 2 * mainSize - n;

  const matches = [];

  // ── Play-in round (round 1, only if needed) ────────────────────────
  // Pool: seeds (directSeeds + 1) … n. Pair top of pool with bottom.
  for (let i = 0; i < playInCount; i++) {
    const topSeed    = directSeeds + 1 + i;
    const bottomSeed = n - i;
    matches.push({
      round:      1,
      matchIndex: i,
      playerA:    participantIds[topSeed - 1],
      playerB:    participantIds[bottomSeed - 1],
      status:     'pending',
      winner:     null,
      playedAt:   null,
    });
  }

  // ── Main bracket (rounds 1+roundOffset … mainRounds+roundOffset) ────
  // Standard seeding (slots in order: 1, mainSize, 2, mainSize-1, …).
  const seeded = buildSeededOrder(mainSize);

  // First main round: fill slots that are direct entries; play-in slots stay null
  // until the play-in winner propagates.
  const mainR1SlotPlayers = seeded.map((seed) =>
    seed <= directSeeds ? participantIds[seed - 1] : null
  );

  for (let r = 1; r <= mainRounds; r++) {
    const matchesInRound = mainSize / Math.pow(2, r);
    for (let i = 0; i < matchesInRound; i++) {
      matches.push({
        round:      r + roundOffset,
        matchIndex: i,
        playerA:    r === 1 ? mainR1SlotPlayers[i * 2]     : null,
        playerB:    r === 1 ? mainR1SlotPlayers[i * 2 + 1] : null,
        status:     'pending',
        winner:     null,
        playedAt:   null,
      });
    }
  }

  // ── Wire up nextMatchKey + isUpperSlot ─────────────────────────────
  matches.forEach((m) => {
    if (hasPlayIn && m.round === 1) {
      // Play-in winner takes the play-in seed's slot in main R1.
      const targetSeed = directSeeds + 1 + m.matchIndex;
      const slotIdx    = seeded.indexOf(targetSeed);
      const r2MatchIdx = Math.floor(slotIdx / 2);
      m.nextMatchKey   = `${1 + roundOffset}-${r2MatchIdx}`;
      m.isUpperSlot    = slotIdx % 2 === 0;
      return;
    }
    const mainRoundIdx = m.round - roundOffset;   // 1-indexed within main bracket
    if (mainRoundIdx === mainRounds) {
      // Final
      m.nextMatchKey = null;
      m.isUpperSlot  = true;
    } else {
      const parentIdx = Math.floor(m.matchIndex / 2);
      m.nextMatchKey  = `${m.round + 1}-${parentIdx}`;
      m.isUpperSlot   = m.matchIndex % 2 === 0;
    }
  });

  return matches;
}

function highestPowerOfTwoLE(n) {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

/**
 * Compute league standings from a list of completed matches.
 * Returns array of { user, played, won, drawn, lost, points } sorted by:
 * 1. points desc, 2. wins desc, 3. user id asc (stable).
 */
function computeStandings(matches, participantIds) {
  const stats = new Map();
  for (const id of participantIds) {
    stats.set(String(id), { user: String(id), played: 0, won: 0, drawn: 0, lost: 0, points: 0 });
  }

  for (const m of matches) {
    if (m.status !== 'completed' && m.status !== 'bye') continue;
    if (m.status === 'bye') {
      // Byes don't count as played in league standings (there's nothing to record).
      continue;
    }
    const a = m.playerA ? String(m.playerA._id || m.playerA) : null;
    const b = m.playerB ? String(m.playerB._id || m.playerB) : null;
    if (!a || !b) continue;

    const sa = stats.get(a);
    const sb = stats.get(b);
    if (!sa || !sb) continue;

    sa.played += 1;
    sb.played += 1;

    if (m.isDraw) {
      sa.drawn += 1; sb.drawn += 1;
      sa.points += 1; sb.points += 1;
    } else if (m.winner) {
      const winId = String(m.winner._id || m.winner);
      if (winId === a) {
        sa.won += 1; sb.lost += 1; sa.points += 3;
      } else if (winId === b) {
        sb.won += 1; sa.lost += 1; sb.points += 3;
      }
    }
  }

  return [...stats.values()].sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.won    !== x.won)    return y.won    - x.won;
    return x.user.localeCompare(y.user);
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────

function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Standard bracket seeding for a given size (must be power of 2).
 * Returns an array where index i contains the seed number that occupies slot i.
 * Adjacent slots play each other in round 1.
 *
 * Example for size 4: [1, 4, 2, 3] → 1v4, 2v3 → winners meet in final.
 * Example for size 8: [1, 8, 4, 5, 2, 7, 3, 6].
 */
function buildSeededOrder(size) {
  let order = [1, 2];
  let s = 2;
  while (order.length < size) {
    s *= 2;
    const next = [];
    for (const seed of order) {
      next.push(seed);
      next.push(s + 1 - seed);
    }
    order = next;
  }
  return order;
}

/**
 * Groups format: split players into tables of `tableSize` using snake seeding.
 *
 * Snake seeding distributes top seeds evenly across tables so every group has
 * a similar strength curve. With 12 players, tableSize=4:
 *   seeds 1..12 → tables: [[1,8,9], [2,7,10], [3,6,11], [4,5,12]] no — let me
 * actually use the standard snake: place seeds in tables by rotating direction
 * each round.
 *
 * For N players and X = tableSize: numTables = ceil(N / X).
 * Returns [{ tableNumber, players: [...] }] with seeds in order.
 */
function generateGroupsPhase(playerIds, tableSize) {
  const n = playerIds.length;
  if (n < 2) return [];
  if (tableSize < 2) tableSize = 2;

  const numTables = Math.ceil(n / tableSize);
  const tables = Array.from({ length: numTables }, () => []);

  // Snake distribution: round 1 forward, round 2 backward, etc.
  for (let i = 0; i < n; i++) {
    const round = Math.floor(i / numTables);
    const within = i % numTables;
    const tableIdx = round % 2 === 0 ? within : (numTables - 1 - within);
    tables[tableIdx].push(playerIds[i]);
  }

  return tables.map((players, idx) => ({
    tableNumber: idx + 1,
    players,
  }));
}

/**
 * Compute standings inside a group from its completed games.
 *
 * @param {Array} games — TorneoGame docs (with `results[]` populated or raw)
 * @param {Array} playerIds — list of player ids in the group (in seed order)
 * @returns {Array} [{ user, played, totalPV, byGame: [score|null, ...] }]
 *                  ordered by totalPV desc, then by seed order as a stable tiebreaker.
 */
function computeGroupStandings(games, playerIds) {
  const stats = new Map();
  const seedOrder = new Map();
  playerIds.forEach((id, idx) => {
    const key = String(id._id || id);
    stats.set(key, { user: key, played: 0, totalPV: 0, byGame: [] });
    seedOrder.set(key, idx);
  });

  // Sort games by gameNumber so byGame entries are in order.
  const sorted = [...games].sort((a, b) => (a.gameNumber || 0) - (b.gameNumber || 0));
  for (const game of sorted) {
    if (game.status !== 'completed') {
      // record placeholders so byGame array length matches
      for (const key of stats.keys()) stats.get(key).byGame.push(null);
      continue;
    }
    const seenInGame = new Set();
    for (const result of game.results || []) {
      const key = String(result.player?._id || result.player);
      const stat = stats.get(key);
      if (!stat) continue;
      stat.played += 1;
      stat.totalPV += Number(result.score) || 0;
      stat.byGame.push(Number(result.score) || 0);
      seenInGame.add(key);
    }
    // Anyone in the group who wasn't in this game's results gets null.
    for (const key of stats.keys()) {
      if (!seenInGame.has(key)) stats.get(key).byGame.push(null);
    }
  }

  return [...stats.values()].sort((a, b) => {
    if (b.totalPV !== a.totalPV) return b.totalPV - a.totalPV;
    return (seedOrder.get(a.user) ?? 0) - (seedOrder.get(b.user) ?? 0);
  });
}

/**
 * Validate that `advancedCount` players can be distributed cleanly into tables of `tableSize`.
 * Returns suggestions for the admin when it doesn't divide cleanly.
 */
function validateNextPhase(advancedCount, tableSize) {
  if (advancedCount <= 0) {
    return { valid: false, suggestions: [], warnings: ['No hay jugadores promovidos'] };
  }
  if (advancedCount <= tableSize) {
    return {
      valid: true,
      isFinal: true,
      tables: 1,
      finalTableSize: advancedCount,
      warnings: [],
    };
  }
  if (advancedCount % tableSize === 0) {
    return {
      valid: true,
      isFinal: false,
      tables: advancedCount / tableSize,
      finalTableSize: tableSize,
      warnings: [],
    };
  }
  // Doesn't divide cleanly. Offer alternatives.
  const suggestions = [];
  // Option A: 1 final table with everyone
  suggestions.push({
    label: `Una sola mesa final de ${advancedCount} jugadores`,
    overrideTableSize: advancedCount,
    tables: 1,
  });
  // Option B: nearest divisors that fit
  for (let candidate = tableSize - 1; candidate >= 3; candidate--) {
    if (advancedCount % candidate === 0) {
      suggestions.push({
        label: `${advancedCount / candidate} mesas de ${candidate}`,
        overrideTableSize: candidate,
        tables: advancedCount / candidate,
      });
      break;
    }
  }
  for (let candidate = tableSize + 1; candidate <= 12; candidate++) {
    if (advancedCount % candidate === 0) {
      suggestions.push({
        label: `${advancedCount / candidate} mesas de ${candidate}`,
        overrideTableSize: candidate,
        tables: advancedCount / candidate,
      });
      break;
    }
  }
  return {
    valid: false,
    suggestions,
    warnings: [`${advancedCount} promovidos no dividen exactamente en mesas de ${tableSize}.`],
  };
}

module.exports = {
  generateLeagueFixture,
  generateSingleElimBracket,
  computeStandings,
  generateGroupsPhase,
  computeGroupStandings,
  validateNextPhase,
};
