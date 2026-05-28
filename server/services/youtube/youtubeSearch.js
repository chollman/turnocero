// Búsqueda de tutoriales en YouTube Data API v3 con cacheo Mongo.
//
// Patrón: Mongo (7d TTL) → YouTube API. La sección "Andá preparado" del
// TableDetail consume este servicio vía GET /api/youtube/como-se-juega.
//
// Política de errores: este servicio NUNCA tira upstream. Siempre devuelve
// `{ items: [] }` en cualquier fallo (key faltante, network, 403, parse).
// La sección del frontend se auto-oculta cuando recibe items vacíos, así
// que un fallo de YouTube no impacta UX más allá de no mostrar tutoriales.
//
// Cuotas: free tier 10 000 units/día. Cada miss consume ~101 units
// (100 search + 1 videos para durations). Con TTL 7d alcanza para ~700
// juegos únicos por semana.

const YoutubeSearchCache = require("../../models/YoutubeSearchCache");
const logger = require("../../utils/logger");

const YT_API = "https://www.googleapis.com/youtube/v3";
const MAX_RESULTS = 3;

// Flag módulo-scope para loguear el missing-key warning una sola vez
// por proceso (evita spam si la sección se consulta en cada page load).
let warnedMissingKey = false;

function warnMissingKeyOnce() {
  if (warnedMissingKey) return;
  warnedMissingKey = true;
  logger.warn(
    "[youtube] YOUTUBE_API_KEY not configured; tutorials section disabled",
  );
}

// Normaliza el nombre del juego para usarlo como cache key:
// lower + trim + colapsar whitespace + strip diacritics. Preserva
// puntuación porque "Catan" y "Catan: Cities & Knights" devuelven
// videos distintos.
function normalizeGameName(name) {
  if (typeof name !== "string") return "";
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// ISO 8601 ("PT12M34S") → "12:34" / "1:02:03" / "0:45". Vacío/inválido → "".
function formatDuration(iso) {
  if (typeof iso !== "string") return "";
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return "";
  const h = Number(m[1]) || 0;
  const mins = Number(m[2]) || 0;
  const s = Number(m[3]) || 0;
  if (h === 0 && mins === 0 && s === 0) return "";
  const pad = (n) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(mins)}:${pad(s)}`;
  return `${mins}:${pad(s)}`;
}

// Wrapper único sobre fetch hacia googleapis. Tira con err.status adosado
// para que el caller pueda distinguir 403 (quotaExceeded) de 5xx (network).
async function fetchYoutube(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Turnocero/1.0" },
  });
  if (!res.ok) {
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* ignorable — algunas respuestas no traen JSON */
    }
    const err = new Error(`YouTube API responded with ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}

// Llama a /search?q=Como se juega <name>. Devuelve array crudo de items.
async function searchVideos(gameName, apiKey) {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: String(MAX_RESULTS),
    q: `Como se juega ${gameName}`,
    key: apiKey,
    relevanceLanguage: "es",
    regionCode: "AR",
    safeSearch: "moderate",
  });
  const data = await fetchYoutube(`${YT_API}/search?${params.toString()}`);
  return Array.isArray(data?.items) ? data.items : [];
}

// Llama a /videos?part=contentDetails&id=ID1,ID2,ID3. Devuelve Map<videoId, duration ISO>.
async function fetchDurations(videoIds, apiKey) {
  if (videoIds.length === 0) return new Map();
  const params = new URLSearchParams({
    part: "contentDetails",
    id: videoIds.join(","),
    key: apiKey,
  });
  const data = await fetchYoutube(`${YT_API}/videos?${params.toString()}`);
  const map = new Map();
  for (const item of data?.items || []) {
    if (item?.id) map.set(item.id, item?.contentDetails?.duration || "");
  }
  return map;
}

/**
 * Busca tutoriales "Como se juega <gameName>" en YouTube.
 *
 * @param {string} gameName — nombre del juego (en bruto, sin normalizar).
 * @returns {Promise<{items: Array<{videoId, title, channel, thumbnail, duration}>}>}
 *
 * Nunca tira — devuelve `{ items: [] }` en cualquier fallo.
 */
async function searchTutorials(gameName) {
  if (!gameName || typeof gameName !== "string" || !gameName.trim()) {
    return { items: [] };
  }

  const query = normalizeGameName(gameName);
  if (!query) return { items: [] };

  // 1) Cache hit en Mongo.
  const cached = await YoutubeSearchCache.findOne({ query }).lean();
  if (cached) {
    return { items: cached.items || [] };
  }

  // 2) API key ausente: warn-once + return vacío SIN persistir cache.
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    warnMissingKeyOnce();
    return { items: [] };
  }

  // 3) Cache miss + key presente: pegar a YouTube.
  let rawItems;
  try {
    rawItems = await searchVideos(gameName.trim(), apiKey);
  } catch (err) {
    const reason = err.body?.error?.errors?.[0]?.reason || null;
    logger.warn("[youtube] search failed", {
      query,
      status: err.status || null,
      reason,
      error: err.message || String(err),
    });
    return { items: [] };
  }

  // 4) Construir items base sin durations.
  const baseItems = rawItems
    .map((it) => {
      const videoId = it?.id?.videoId;
      if (!videoId) return null;
      const sn = it.snippet || {};
      const thumb =
        sn.thumbnails?.medium?.url ||
        sn.thumbnails?.default?.url ||
        sn.thumbnails?.high?.url ||
        "";
      return {
        videoId,
        title: sn.title || "",
        channel: sn.channelTitle || "",
        thumbnail: thumb,
        duration: "",
      };
    })
    .filter(Boolean);

  // 5) Llamar a /videos para enriquecer con duration. Si esto falla,
  //    devolvemos los items igual con duration: "". No fallar la
  //    request entera por un nice-to-have.
  if (baseItems.length > 0) {
    try {
      const durationsMap = await fetchDurations(
        baseItems.map((it) => it.videoId),
        apiKey,
      );
      for (const item of baseItems) {
        const iso = durationsMap.get(item.videoId);
        if (iso) item.duration = formatDuration(iso);
      }
    } catch (err) {
      logger.warn("[youtube] durations fetch failed (non-fatal)", {
        query,
        error: err.message || String(err),
      });
    }
  }

  // 6) Persistir (negative caching incluido: si baseItems es [],
  //    igual escribimos para no requemar quota en repeticiones).
  try {
    await YoutubeSearchCache.findOneAndUpdate(
      { query },
      { query, items: baseItems, lastFetchedAt: new Date() },
      { upsert: true, setDefaultsOnInsert: true },
    );
  } catch (err) {
    logger.warn("[youtube] cache upsert failed (non-fatal)", {
      query,
      error: err.message || String(err),
    });
  }

  return { items: baseItems };
}

module.exports = {
  searchTutorials,
  normalizeGameName,
  formatDuration,
};
