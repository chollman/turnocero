const mongoose = require("mongoose");

// Variantes/tableros/escenarios que un usuario usó para un juego, para
// ofrecerlas en un picker al cargar más partidas del mismo juego. Es texto
// libre relacionado al (bggUsername, gameId); no va a BGG como entidad, sólo
// alimenta el autocompletado (la variante en sí viaja dentro de `comments`).
const bggGameVariantSchema = new mongoose.Schema(
  {
    bggUsername: { type: String, required: true, lowercase: true, trim: true },
    gameId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Una variante por (usuario, juego, nombre). El upsert refresca lastUsedAt.
bggGameVariantSchema.index(
  { bggUsername: 1, gameId: 1, name: 1 },
  { unique: true },
);
bggGameVariantSchema.index({ bggUsername: 1, gameId: 1, lastUsedAt: -1 });

module.exports = mongoose.model("BggGameVariant", bggGameVariantSchema);
