// Búsqueda de juegos en el catálogo de BGG (xmlapi2/search), con ranking por
// relevancia y thumbnails. Extraída de GET /api/bgg/search para reutilizarla
// desde el agente de carga de partidas. Lanza si BGG no responde; el caller
// decide cómo reportarlo (el endpoint lo traduce a 502).

const { scoreSearchMatch } = require("./bggSearch");
const { getCached, setCached } = require("./bggCache");
const { parser } = require("./bggParse");
const { BGG_API, fetchBgg, resolveGamesBatch } = require("./bggResolve");

const MAX_RESULTS = 30;

async function searchBggCatalog(rawQuery) {
  const q = String(rawQuery || "").trim();
  if (q.length < 3) return [];

  const cacheKey = `search:${q.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const xml = await fetchBgg(
    `${BGG_API}/search?query=${encodeURIComponent(q)}&type=boardgame`,
  );
  const parsed = parser.parse(xml);

  const root = parsed?.items;
  if (!root) return [];

  const rawItems = root.item || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  const results = items
    .map((item) => {
      const nameRaw = item.name;
      const nameArr = Array.isArray(nameRaw) ? nameRaw : [nameRaw];
      const primary =
        nameArr.find((n) => n["@_type"] === "primary") || nameArr[0];
      const name = primary?.["@_value"] || "";
      const year = item.yearpublished?.["@_value"]
        ? Number(item.yearpublished["@_value"])
        : null;
      return {
        id: Number(item["@_id"]),
        name,
        year,
        thumbnail: null,
        image: null,
      };
    })
    .filter((g) => g.name)
    // Ranking por relevancia (bucket de match → nombre corto → año desc).
    // xmlapi2/search no devuelve los items en ningún orden útil; este sort
    // los pone más cerca del orden que BGG usa en su autocomplete (que está
    // gateado por Cloudflare desde Node, ver historia de PR).
    .sort((a, b) => {
      const sa = scoreSearchMatch(a.name, q);
      const sb = scoreSearchMatch(b.name, q);
      if (sa !== sb) return sa - sb;
      if (a.name.length !== b.name.length) return a.name.length - b.name.length;
      return (b.year || 0) - (a.year || 0);
    })
    .slice(0, MAX_RESULTS);

  // Batch-resolve thumbnails + images (memoria → Mongo → BGG, compartido entre usuarios)
  if (results.length > 0) {
    try {
      const gamesMap = await resolveGamesBatch(results.map((g) => g.id));
      results.forEach((g) => {
        const game = gamesMap.get(g.id);
        g.thumbnail = game?.thumbnail || null;
        g.image = game?.image || null;
      });
    } catch {
      // thumbnails son opcionales, no bloqueamos el resultado
    }
  }

  setCached(cacheKey, results);
  return results;
}

module.exports = { searchBggCatalog };
