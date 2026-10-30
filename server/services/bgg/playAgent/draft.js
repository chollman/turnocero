// Validación y normalización del borrador de partida que arma el agente.
// Puro (sin Mongo ni red): el handler de la tool le pasa lo que necesita
// (fecha de hoy, datos del juego, si ya hay una partida igual ese día).
//
// Dos niveles:
//   errors   — el borrador no se puede usar así (fecha inválida, sin juego,
//              sin jugadores...). Se le devuelven al modelo como is_error para
//              que corrija o pregunte.
//   warnings — cosas sospechosas que el usuario tiene que confirmar (cantidad
//              de jugadores fuera de rango, ganador incoherente con puntajes,
//              posible duplicado...). No bloquean: el borrador se crea igual y
//              el agente las comenta.
//
// La salida (`draft`) tiene la forma que hidrata PlayForm en el cliente:
// { game, details, mode, coopResult, variant, expansions, players[] }.

const MAX_PLAYERS = 50;
const MODES = ["versus", "coop", "equipos"];
const TEAM_IDS = ["A", "B", "C", "D"];
const MAX_TEXT = 200;
const MAX_NOTES = 600;

function str(v, max = MAX_TEXT) {
  return String(v ?? "")
    .trim()
    .slice(0, max);
}

function isIsoDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function toScore(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizePlayer(p = {}) {
  const team = str(p.team, 1).toUpperCase();
  return {
    name: str(p.name, 80),
    username: str(p.username, 60),
    score: toScore(p.score),
    win: !!p.win,
    team: TEAM_IDS.includes(team) ? team : "",
    // BGG guarda el campo Color/Team con un tope de 30 caracteres.
    faction: str(p.faction, 30),
  };
}

// input: lo que mandó el modelo a create_play_draft.
// ctx: { today: "YYYY-MM-DD", ownerUsername, game: { minPlayers, maxPlayers } | null,
//        duplicateSameDay: boolean }
function validateDraft(input = {}, ctx = {}) {
  const errors = [];
  const warnings = [];

  const gameId = str(input.gameId, 12);
  if (!/^\d+$/.test(gameId)) errors.push("gameId must be a numeric BGG id");

  const playdate = str(input.playdate, 10);
  if (!isIsoDate(playdate)) {
    errors.push("playdate must be a valid YYYY-MM-DD date");
  } else if (ctx.today && playdate > ctx.today) {
    errors.push("playdate cannot be in the future");
  }

  const mode = MODES.includes(input.mode) ? input.mode : "versus";

  let length = null;
  if (input.length !== null && input.length !== undefined && input.length !== "") {
    const n = Number(input.length);
    if (!Number.isFinite(n) || n <= 0 || n > 24 * 60) {
      errors.push("length must be a positive number of minutes (max 1440)");
    } else {
      length = Math.round(n);
    }
  }

  const rawPlayers = Array.isArray(input.players) ? input.players : [];
  const players = rawPlayers.map(normalizePlayer).filter((p) => p.name || p.username);
  if (players.length === 0) errors.push("players must include at least one player");
  if (players.length > MAX_PLAYERS) errors.push(`players cannot exceed ${MAX_PLAYERS}`);

  // El dueño de la cuenta siempre juega: si el modelo se olvidó de incluirlo,
  // es un error (no lo agregamos solos porque no sabemos su puntaje).
  const owner = String(ctx.ownerUsername || "").toLowerCase();
  if (
    owner &&
    players.length > 0 &&
    !players.some((p) => p.username.toLowerCase() === owner)
  ) {
    errors.push(
      `players must include the account owner (username "${ctx.ownerUsername}")`,
    );
  }

  // ── Coherencia por modo ──────────────────────────────────────────
  let coopResult = null;
  if (mode === "coop") {
    coopResult = input.coopResult === "lost" ? "lost" : "won";
    for (const p of players) {
      p.win = coopResult === "won";
      p.score = null;
      p.team = "";
    }
  } else if (mode === "equipos") {
    const missing = players.filter((p) => !p.team);
    if (missing.length) {
      errors.push("in teams mode every player needs a team (A, B, C or D)");
    }
    const teams = new Set(players.map((p) => p.team).filter(Boolean));
    if (teams.size === 1) warnings.push("all players are on the same team");
    const winningTeams = new Set(players.filter((p) => p.win).map((p) => p.team));
    if (winningTeams.size > 1) {
      warnings.push("more than one team is marked as winner");
    }
    // En modo equipos la facción no aplica: `color` guarda el equipo.
    for (const p of players) p.faction = "";
  } else {
    const scored = players.filter((p) => p.score !== null);
    const winners = players.filter((p) => p.win);
    if (scored.length >= 2 && winners.length > 0) {
      const max = Math.max(...scored.map((p) => p.score));
      const winnerNotTop = winners.some((p) => p.score !== null && p.score < max);
      if (winnerNotTop) {
        warnings.push(
          "a winner does not have the highest score (fine only if lowest score wins in this game)",
        );
      }
    }
    if (players.length > 1 && winners.length === players.length) {
      warnings.push("every player is marked as winner in a competitive game");
    }
    const factions = players.map((p) => p.faction.toLowerCase()).filter(Boolean);
    if (new Set(factions).size !== factions.length) {
      warnings.push("two players have the same faction or character");
    }
  }

  // ── Datos del juego ──────────────────────────────────────────────
  const minP = Number(ctx.game?.minPlayers) || null;
  const maxP = Number(ctx.game?.maxPlayers) || null;
  if (players.length && minP && players.length < minP) {
    warnings.push(`the game needs at least ${minP} players`);
  }
  if (players.length && maxP && players.length > maxP) {
    warnings.push(`the game supports at most ${maxP} players (maybe an expansion?)`);
  }
  if (ctx.duplicateSameDay) {
    warnings.push("there is already a play of this game on that date (possible duplicate)");
  }

  const expansions = (Array.isArray(input.expansions) ? input.expansions : [])
    .map((e) => ({ id: str(e?.id, 12), name: str(e?.name, 120) }))
    .filter((e) => /^\d+$/.test(e.id) && e.name)
    .slice(0, 20);

  const draft = {
    game: { id: gameId, name: str(input.gameName, 160) },
    details: {
      playdate,
      length,
      location: str(input.location, 120),
      comments: str(input.notes, MAX_NOTES),
    },
    mode,
    coopResult,
    variant: str(input.variant, 120),
    expansions,
    players: players.map((p) => ({
      name: p.name || p.username,
      username: p.username,
      score: p.score === null ? "" : String(p.score),
      win: p.win,
      team: p.team,
      faction: p.faction,
    })),
  };

  return { ok: errors.length === 0, errors, warnings, draft };
}

module.exports = { validateDraft, MAX_PLAYERS, MODES };
