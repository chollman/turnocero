const mongoose = require("mongoose");

/**
 * Cache de metadata de un video individual de YouTube (modo "manual" de la
 * sección "Andá preparado" en TableDetail).
 *
 * Cada doc representa un videoId único y guarda su título / canal /
 * thumbnail / duración. TTL de 30 días — el metadata de un video específico
 * es estable, así que duplicamos el TTL del YoutubeSearchCache (7d) para
 * minimizar quota burn.
 */
const youtubeVideoCacheSchema = new mongoose.Schema(
  {
    videoId: { type: String, required: true, unique: true, index: true },
    title: { type: String, default: "" },
    channel: { type: String, default: "" },
    thumbnail: { type: String, default: "" },
    duration: { type: String, default: "" },
    lastFetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

youtubeVideoCacheSchema.index(
  { lastFetchedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 },
);

module.exports = mongoose.model("YoutubeVideoCache", youtubeVideoCacheSchema);
