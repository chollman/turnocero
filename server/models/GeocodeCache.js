const mongoose = require("mongoose");

/**
 * Cache de resultados de geocoding (texto → coordenadas).
 *
 * Cada doc representa una query única (texto en minúscula + trimmeado) y guarda
 * el resultado de Google Geocoding API. TTL de 30 días vía índice (Mongo borra
 * automáticamente cuando lastFetchedAt es más viejo que eso).
 *
 * El campo `query` es el normalizado (lower + trim + collapsed spaces); `formatted`
 * guarda la dirección "linda" que devuelve Google para mostrar de vuelta al usuario.
 */
const geocodeCacheSchema = new mongoose.Schema(
  {
    query: { type: String, required: true, unique: true, index: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    formatted: { type: String, default: "" },
    lastFetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// TTL: expira docs 30 días después del último fetch.
geocodeCacheSchema.index(
  { lastFetchedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 },
);

module.exports = mongoose.model("GeocodeCache", geocodeCacheSchema);
