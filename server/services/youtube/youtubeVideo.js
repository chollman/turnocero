// Resolución de metadata de un video específico de YouTube (modo "manual"
// de la sección "Andá preparado").
//
// Patrón: Mongo (30d TTL) → YouTube API. Si no hay API key o YouTube falla,
// devolvemos un fallback con thumbnail directo (i.ytimg.com es público) y
// título / canal / duración vacíos. La card del frontend tolera campos
// vacíos (oculta el badge de duración, muestra el título vacío).
//
// El servicio NUNCA tira al caller (excepto por videoId formato inválido →
// 400 explícito); igual que searchTutorials, fallos upstream se traducen a
// "respuesta degradada" para mantener la UX consistente.

const YoutubeVideoCache = require("../../models/YoutubeVideoCache");
const logger = require("../../utils/logger");
const httpError = require("../../utils/httpError");
const { formatDuration } = require("./youtubeSearch");

const YT_API = "https://www.googleapis.com/youtube/v3";
const VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

let warnedMissingKey = false;

function warnMissingKeyOnce() {
  if (warnedMissingKey) return;
  warnedMissingKey = true;
  logger.warn(
    "[youtube] YOUTUBE_API_KEY not configured; falling back to public thumbnails for manual videos",
  );
}

/**
 * Acepta tanto un videoId puro (11 chars) como una URL completa de YouTube
 * (watch / youtu.be / embed / shorts). Devuelve el videoId extraído o null.
 *
 * Idéntico al parser del cliente (client/src/utils/youtube.js) — duplicado
 * acá como defensa por si llega un URL al server por error.
 */
function parseYouTubeVideoId(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Caso 1: ya es un ID puro.
  if (VIDEO_ID_REGEX.test(trimmed)) return trimmed;

  // Caso 2: URL. Probamos varios patrones.
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})(?:[&?#]|$)/, // /watch?v=ID
    /youtu\.be\/([A-Za-z0-9_-]{11})(?:[?#]|$)/, // youtu.be/ID
    /\/embed\/([A-Za-z0-9_-]{11})(?:[?#]|$)/, // /embed/ID
    /\/shorts\/([A-Za-z0-9_-]{11})(?:[?#]|$)/, // /shorts/ID
  ];
  for (const re of patterns) {
    const m = re.exec(trimmed);
    if (m) return m[1];
  }
  return null;
}

function fallbackResponse(videoId) {
  return {
    videoId,
    title: "",
    channel: "",
    thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    duration: "",
  };
}

async function fetchYoutubeVideo(videoId, apiKey) {
  const params = new URLSearchParams({
    part: "snippet,contentDetails",
    id: videoId,
    key: apiKey,
  });
  const res = await fetch(`${YT_API}/videos?${params.toString()}`, {
    headers: { "User-Agent": "Turnocero/1.0" },
  });
  if (!res.ok) {
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    const err = new Error(`YouTube video API responded with ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}

/**
 * Resuelve el metadata de un video por ID.
 *
 * @param {string} videoId — 11 chars [A-Za-z0-9_-].
 * @returns {Promise<{videoId, title, channel, thumbnail, duration}>}
 * @throws httpError(400) si el videoId es inválido.
 */
async function resolveVideo(videoId) {
  if (!VIDEO_ID_REGEX.test(String(videoId || ""))) {
    throw httpError(400, "Video ID de YouTube inválido");
  }

  // Cache hit.
  const cached = await YoutubeVideoCache.findOne({ videoId }).lean();
  if (cached) {
    return {
      videoId: cached.videoId,
      title: cached.title,
      channel: cached.channel,
      thumbnail: cached.thumbnail,
      duration: cached.duration,
    };
  }

  // Sin API key → fallback sin persistir cache.
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    warnMissingKeyOnce();
    return fallbackResponse(videoId);
  }

  // Llamar a YouTube.
  let data;
  try {
    data = await fetchYoutubeVideo(videoId, apiKey);
  } catch (err) {
    const reason = err.body?.error?.errors?.[0]?.reason || null;
    logger.warn("[youtube] video fetch failed", {
      videoId,
      status: err.status || null,
      reason,
      error: err.message || String(err),
    });
    return fallbackResponse(videoId);
  }

  const item = Array.isArray(data?.items) ? data.items[0] : null;
  if (!item) {
    // Video inexistente / privado / borrado → fallback (no persistir, por si
    // el video vuelve a estar disponible más adelante).
    logger.warn("[youtube] video not found", { videoId });
    return fallbackResponse(videoId);
  }

  const sn = item.snippet || {};
  const cd = item.contentDetails || {};
  const result = {
    videoId,
    title: sn.title || "",
    channel: sn.channelTitle || "",
    thumbnail:
      sn.thumbnails?.medium?.url ||
      sn.thumbnails?.default?.url ||
      sn.thumbnails?.high?.url ||
      `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    duration: formatDuration(cd.duration || ""),
  };

  try {
    await YoutubeVideoCache.findOneAndUpdate(
      { videoId },
      { ...result, lastFetchedAt: new Date() },
      { upsert: true, setDefaultsOnInsert: true },
    );
  } catch (err) {
    logger.warn("[youtube] video cache upsert failed (non-fatal)", {
      videoId,
      error: err.message || String(err),
    });
  }

  return result;
}

module.exports = {
  resolveVideo,
  parseYouTubeVideoId,
  VIDEO_ID_REGEX,
};
