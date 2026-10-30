// Definiciones (JSON Schema) de las tools que ve el modelo. Las descripciones
// son la parte más importante: el modelo elige qué tool usar leyéndolas.
// Se mantienen fijas (sin datos del usuario) para que el prefijo sea
// cacheable con prompt caching.

const TOOLS = [
  {
    name: "search_games",
    description:
      "Search for a board game by name. Looks first in the user's own games (played or owned), " +
      "then in the BoardGameGeek catalog. Returns up to 5 candidates with their BGG id. " +
      "Prefer results with source 'my_games' and more timesPlayed: when the user says 'Catan' " +
      "they almost always mean the edition they usually play. Use the base game name, not the expansion.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Game name as the user said it, e.g. 'wingspan'" },
      },
      required: ["query"],
    },
  },
  {
    name: "find_players",
    description:
      "Match the names the user mentioned against people they have played with before. " +
      "Returns, for each spoken name, up to 3 candidates with confidence 'exact', 'prefix' or 'fuzzy', " +
      "plus the account owner (who always plays). Do NOT include the owner or words like 'yo'/'me' in names. " +
      "If a name has no candidates, it is a new guest: confirm with the user before adding them by name only.",
    input_schema: {
      type: "object",
      properties: {
        names: {
          type: "array",
          items: { type: "string" },
          description: "Names or nicknames exactly as the user said them",
        },
      },
      required: ["names"],
    },
  },
  {
    name: "get_game_variants",
    description:
      "Get options for a game: board/scenario/variant names the user used before, " +
      "factions/characters used before, and the game's official expansions. " +
      "Call it ONLY when the user mentioned a scenario, map, mode, difficulty, faction, character " +
      "or expansion. Pass a short query with the words the user used to keep the result small; " +
      "names are often in English, so if the query returns nothing, call it again without query.",
    input_schema: {
      type: "object",
      properties: {
        gameId: { type: "string", description: "BGG id of the base game" },
        query: {
          type: "string",
          description: "Optional filter, e.g. 'invierno' or 'europa'",
        },
      },
      required: ["gameId"],
    },
  },
  {
    name: "create_play_draft",
    description:
      "Create the play draft that will prefill the play form. The user reviews it and saves it themselves; " +
      "this tool never saves anything. Returns ok=false with errors to fix, or ok=true with warnings " +
      "you must briefly mention to the user. Only call it after search_games and find_players.",
    input_schema: {
      type: "object",
      properties: {
        gameId: { type: "string", description: "BGG id of the base game" },
        gameName: { type: "string" },
        playdate: { type: "string", description: "YYYY-MM-DD, resolved from today's date" },
        length: { type: "number", description: "Duration in minutes, only if the user said it" },
        location: { type: "string", description: "Only if the user said it" },
        mode: {
          type: "string",
          enum: ["versus", "coop", "equipos"],
          description: "versus = competitive, coop = cooperative, equipos = teams",
        },
        coopResult: {
          type: "string",
          enum: ["won", "lost"],
          description: "Only for coop mode",
        },
        variant: {
          type: "string",
          description: "Scenario, board, map, mode or difficulty for the whole play",
        },
        expansions: {
          type: "array",
          items: {
            type: "object",
            properties: { id: { type: "string" }, name: { type: "string" } },
            required: ["id", "name"],
          },
          description: "Only expansions from get_game_variants",
        },
        notes: { type: "string", description: "Free notes the user asked to add" },
        players: {
          type: "array",
          description: "Every player, including the account owner",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              username: {
                type: "string",
                description: "BGG username from find_players; empty for guests",
              },
              score: { type: "number" },
              win: { type: "boolean" },
              team: {
                type: "string",
                enum: ["A", "B", "C", "D"],
                description: "Only in equipos mode",
              },
              faction: {
                type: "string",
                description: "Faction, character or spirit for this player (not in equipos mode)",
              },
            },
            required: ["name"],
          },
        },
      },
      required: ["gameId", "gameName", "playdate", "mode", "players"],
    },
  },
];

module.exports = { TOOLS };
