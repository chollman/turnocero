// Handlers de las tools del agente que leen los datos fijos de fixtures.js en
// vez de Mongo/BGG. Reutilizan la misma lógica pura que producción (matching
// de nombres y validación del borrador), así la evaluación mide al modelo y al
// prompt, no a una copia distinta de las reglas.

const { normalizeForSearch } = require("../../services/bgg/bggUserGames");
const { matchPlayerNames } = require("../../services/bgg/playAgent/matching");
const { validateDraft } = require("../../services/bgg/playAgent/draft");
const fx = require("./fixtures");

const MAX_RESULTS = 5;

function includes(text, query) {
  return normalizeForSearch(text).includes(normalizeForSearch(query));
}

function makeFixtureHandlers(data = fx) {
  return {
    search_games: async ({ query = "" } = {}) => {
      if (normalizeForSearch(query).length < 2) return { results: [], note: "query too short" };
      const results = data.MY_GAMES.filter((g) => includes(g.name, query))
        .sort((a, b) => b.timesPlayed - a.timesPlayed)
        .slice(0, MAX_RESULTS)
        .map((g) => ({
          id: g.id,
          name: g.name,
          year: g.year,
          timesPlayed: g.timesPlayed,
          owned: g.owned,
          source: "my_games",
        }));
      if (results.length < 3) {
        for (const g of data.BGG_CATALOG) {
          if (results.length >= MAX_RESULTS) break;
          if (!includes(g.name, query) || results.some((r) => r.id === g.id)) continue;
          results.push({ id: g.id, name: g.name, year: g.year, source: "bgg" });
        }
      }
      return { results };
    },

    find_players: async ({ names = [] } = {}) => ({
      owner: data.OWNER,
      matches: matchPlayerNames(names, data.CO_PLAYERS),
    }),

    get_game_variants: async ({ gameId, query = "" } = {}) => {
      if (!/^\d+$/.test(String(gameId || ""))) return { error: "gameId must be a numeric BGG id" };
      const v = data.VARIANTS[gameId] || { variants: [], factions: [], expansions: [] };
      const pick = (list, key = (x) => x) =>
        list.filter((x) => !query || includes(key(x), query)).slice(0, 10);
      return {
        variants: pick(v.variants),
        factions: pick(v.factions),
        expansions: pick(v.expansions, (e) => e.name),
      };
    },

    create_play_draft: async (input = {}) => {
      const game = data.gameById(input.gameId);
      const result = validateDraft(input, {
        today: data.TODAY,
        ownerUsername: data.OWNER.username,
        game,
        duplicateSameDay: false,
      });
      if (result.ok && game) result.draft.game = { id: game.id, name: game.name };
      return result;
    },
  };
}

module.exports = { makeFixtureHandlers };
