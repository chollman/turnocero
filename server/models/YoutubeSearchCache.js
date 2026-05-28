const mongoose = require("mongoose");

/**
 * Cache de búsquedas en YouTube Data API v3 ("Como se juega [juego]").
 *
 * Cada doc representa una query única (nombre del juego normalizado: lower
 * + trim + colapsar espacios + strip diacritics) y guarda los primeros 3
 * resultados de YouTube. TTL de 7 días vía índice (Mongo borra el doc
 * automáticamente cuando lastFetchedAt es más viejo que eso).
 *
 * Cacheamos también `items: []` (negative caching) — para que juegos con
 * resultados vacíos no requemen quota de YouTube en cada visita.
 */
const youtubeSearchCacheSchema = new mongoose.Schema(
  {
    query: { type: String, required: true, unique: true, index: true },
    items: [
      {
        _id: false,
        videoId: { type: String, required: true },
        title: { type: String, default: "" },
        channel: { type: String, default: "" },
        thumbnail: { type: String, default: "" },
        duration: { type: String, default: "" },
      },
    ],
    lastFetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

youtubeSearchCacheSchema.index(
  { lastFetchedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 7 },
);

module.exports = mongoose.model("YoutubeSearchCache", youtubeSearchCacheSchema);
