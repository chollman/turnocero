// Matching de nombres dichos por el usuario ("Juan", "Meli", "juanchi") contra
// sus compañeros de juego (computePlayedCoPlayers + overlay). Puro: sin Mongo,
// para poder testearlo aislado.
//
// Confianza, de mayor a menor:
//   exact  — nombre o @BGG iguales (normalizados: sin tildes ni mayúsculas)
//   prefix — el nombre (o una de sus palabras) empieza con lo dicho ("meli" → "Melina Gómez")
//   fuzzy  — lo dicho aparece dentro del nombre o del @BGG
//
// El agente decide con esto: un solo `exact`/`prefix` claro → lo usa; varios
// candidatos razonables → pregunta.

const { normalizeForSearch } = require("../bggUserGames");

const MAX_CANDIDATES = 3;
const RANK = { exact: 0, prefix: 1, fuzzy: 2 };

function words(s) {
  return normalizeForSearch(s).split(/[\s._-]+/).filter(Boolean);
}

function confidenceFor(spoken, coPlayer) {
  const q = normalizeForSearch(spoken);
  if (!q) return null;
  const name = normalizeForSearch(coPlayer.name);
  const username = normalizeForSearch(coPlayer.username);

  if (q === name || (username && q === username)) return "exact";
  if (
    name.startsWith(q) ||
    (username && username.startsWith(q)) ||
    words(coPlayer.name).some((w) => w.startsWith(q))
  ) {
    return "prefix";
  }
  if (q.length >= 3 && (name.includes(q) || (username && username.includes(q)))) {
    return "fuzzy";
  }
  return null;
}

// names: string[] tal cual los dijo el usuario.
// coPlayers: [{ name, username, numPlays, lastPlayedDate }]
// Devuelve [{ spoken, candidates: [{ name, username, confidence, numPlays, lastPlayedDate }] }]
// con candidatos ordenados por confianza, después por más partidas juntos y
// después por recencia.
function matchPlayerNames(names = [], coPlayers = []) {
  return names.map((spoken) => {
    const candidates = [];
    for (const cp of coPlayers) {
      const confidence = confidenceFor(spoken, cp);
      if (!confidence) continue;
      candidates.push({
        name: cp.name || cp.username || "",
        username: cp.username || "",
        confidence,
        numPlays: cp.numPlays || 0,
        lastPlayedDate: cp.lastPlayedDate || null,
      });
    }
    candidates.sort((a, b) => {
      if (RANK[a.confidence] !== RANK[b.confidence]) {
        return RANK[a.confidence] - RANK[b.confidence];
      }
      if (a.numPlays !== b.numPlays) return b.numPlays - a.numPlays;
      return (b.lastPlayedDate || "").localeCompare(a.lastPlayedDate || "");
    });
    return { spoken, candidates: candidates.slice(0, MAX_CANDIDATES) };
  });
}

module.exports = { matchPlayerNames, confidenceFor, MAX_CANDIDATES };
