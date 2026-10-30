// Implementación de las tools del agente de carga de partidas. Cada handler
// recibe el `input` que mandó el modelo y un `ctx` armado por el servidor
// ({ bggUsername, ownerBggUsername, ownerName, today }) — el modelo nunca elige
// de quién son los datos que consulta: siempre son los del usuario logueado.
//
// Los resultados se mantienen chicos a propósito (solo los campos que el
// agente usa): cada token de un tool_result se reenvía en todas las vueltas
// siguientes del bucle.

const BggUserGame = require("../../../models/BggUserGame");
const BggGameVariant = require("../../../models/BggGameVariant");
const BggPlay = require("../../../models/BggPlay");
const { escapeRegex } = require("../../../utils/regex");
const logger = require("../../../utils/logger");
const { ensureFreshUserGames, normalizeForSearch } = require("../bggUserGames");
const { searchBggCatalog } = require("../bggCatalogSearch");
const { resolveGame, resolveGameExpansions } = require("../bggResolve");
const { computePlayedCoPlayers } = require("../bggAggregations");
const { loadOverlayIndex, applyOverlayToCoPlayers } = require("../bggPlayerOverlay");
const { matchPlayerNames } = require("./matching");
const { validateDraft } = require("./draft");

const MAX_GAME_RESULTS = 5;
const MAX_NAMES = 20;
const MAX_VARIANT_ITEMS = 10;
const TEAM_COLOR_RE = /^equipo\s+[A-D]$/i;

function matchesQuery(text, query) {
  if (!query) return true;
  return normalizeForSearch(text).includes(normalizeForSearch(query));
}

async function searchGames(input, ctx) {
  const query = String(input?.query || "").trim();
  if (normalizeForSearch(query).length < 2) {
    return { results: [], note: "query too short" };
  }

  try {
    await ensureFreshUserGames(ctx.bggUsername);
  } catch (e) {
    logger.warn("[playAgent] ensureFreshUserGames failed", { error: e.message });
  }

  const own = await BggUserGame.find({
    bggUsername: ctx.bggUsername,
    searchName: new RegExp(escapeRegex(normalizeForSearch(query))),
  })
    .sort({ lastPlayedDate: -1, numPlays: -1, name: 1 })
    .limit(MAX_GAME_RESULTS)
    .lean();

  const results = own.map((r) => ({
    id: String(r.gameId),
    name: r.name,
    year: r.year || null,
    timesPlayed: r.numPlays || 0,
    owned: !!r.owned,
    source: "my_games",
  }));

  // Si en "Mis juegos" hay pocos resultados, completar con el catálogo de BGG.
  if (results.length < 3) {
    try {
      const catalog = await searchBggCatalog(query);
      const seen = new Set(results.map((r) => r.id));
      for (const g of catalog) {
        if (results.length >= MAX_GAME_RESULTS) break;
        const id = String(g.id);
        if (seen.has(id)) continue;
        results.push({ id, name: g.name, year: g.year || null, source: "bgg" });
      }
    } catch (e) {
      logger.warn("[playAgent] BGG catalog search failed", { error: e.message });
      if (results.length === 0) {
        return { results: [], note: "BGG search is unavailable right now" };
      }
    }
  }

  return { results };
}

async function findPlayers(input, ctx) {
  const names = (Array.isArray(input?.names) ? input.names : [])
    .map((n) => String(n || "").trim())
    .filter(Boolean)
    .slice(0, MAX_NAMES);

  const [raw, overlayIndex] = await Promise.all([
    computePlayedCoPlayers(ctx.bggUsername),
    loadOverlayIndex(ctx.bggUsername),
  ]);
  const coPlayers = applyOverlayToCoPlayers(raw, overlayIndex, {
    excludeSelf: true,
  });

  return {
    owner: { name: ctx.ownerName, username: ctx.ownerBggUsername },
    matches: matchPlayerNames(names, coPlayers),
  };
}

async function getGameVariants(input, ctx) {
  const gameId = String(input?.gameId || "");
  if (!/^\d+$/.test(gameId)) return { error: "gameId must be a numeric BGG id" };
  const query = String(input?.query || "").trim();

  const [variantRows, factionAgg] = await Promise.all([
    BggGameVariant.find({ bggUsername: ctx.bggUsername, gameId })
      .sort({ lastUsedAt: -1 })
      .limit(50)
      .select("name -_id")
      .lean(),
    // Facciones/personajes que el usuario ya cargó en el campo `color` de
    // jugadores de este juego (sin contar los "Equipo X").
    BggPlay.aggregate([
      { $match: { bggUsername: ctx.bggUsername, gameId } },
      { $unwind: "$players" },
      { $match: { "players.color": { $nin: [null, ""] } } },
      { $group: { _id: "$players.color", uses: { $sum: 1 } } },
      { $sort: { uses: -1 } },
      { $limit: 50 },
    ]),
  ]);

  const variants = variantRows
    .map((v) => v.name)
    .filter((name) => matchesQuery(name, query))
    .slice(0, MAX_VARIANT_ITEMS);

  const factions = factionAgg
    .map((f) => String(f._id).trim())
    .filter((name) => name && !TEAM_COLOR_RE.test(name))
    .filter((name) => matchesQuery(name, query))
    .slice(0, MAX_VARIANT_ITEMS);

  let expansions = [];
  try {
    expansions = (await resolveGameExpansions(gameId))
      .filter((e) => matchesQuery(e.name, query))
      .slice(0, MAX_VARIANT_ITEMS)
      .map((e) => ({ id: String(e.id), name: e.name }));
  } catch (e) {
    logger.warn("[playAgent] resolveGameExpansions failed", { error: e.message });
  }

  return { variants, factions, expansions };
}

async function createPlayDraft(input, ctx) {
  const gameId = String(input?.gameId || "");
  let game = null;
  if (/^\d+$/.test(gameId)) {
    try {
      game = await resolveGame(Number(gameId));
    } catch (e) {
      logger.warn("[playAgent] resolveGame failed", { error: e.message });
    }
  }

  const playdate = String(input?.playdate || "");
  const duplicateSameDay =
    !!game &&
    /^\d{4}-\d{2}-\d{2}$/.test(playdate) &&
    !!(await BggPlay.exists({ bggUsername: ctx.bggUsername, gameId, date: playdate }));

  const result = validateDraft(input, {
    today: ctx.today,
    ownerUsername: ctx.ownerBggUsername,
    game,
    duplicateSameDay,
  });

  if (result.ok && game) {
    result.draft.game = {
      id: gameId,
      name: game.name || result.draft.game.name,
      thumbnail: game.thumbnail || null,
      image: game.image || null,
      year: game.year || null,
    };
  }
  return result;
}

const HANDLERS = {
  search_games: searchGames,
  find_players: findPlayers,
  get_game_variants: getGameVariants,
  create_play_draft: createPlayDraft,
};

module.exports = {
  HANDLERS,
  searchGames,
  findPlayers,
  getGameVariants,
  createPlayDraft,
};
