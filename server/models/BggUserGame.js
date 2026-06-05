const mongoose = require("mongoose");

// Cache materializado de la lista "Mis juegos" de un usuario (ludoteca ∪
// juegos jugados) para alimentar el selector al cargar partidas, con
// paginación + búsqueda server-side.
//
// NO es una fuente de verdad: se RECONSTRUYE desde BggPlay + BggCollection
// (ver services/bgg/bggUserGames.js#rebuildUserGames). Se reconstruye lazy al
// leer si está vieja/sucia (User.bggSync.userGamesBuiltAt) y se invalida en
// los eventos que cambian datos. Una fila por (bggUsername, gameId).
const bggUserGameSchema = new mongoose.Schema(
  {
    bggUsername: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    gameId: { type: String, required: true },
    name: { type: String, default: null },
    thumbnail: { type: String, default: null },
    image: { type: String, default: null },
    year: { type: Number, default: null },
    numPlays: { type: Number, default: 0 },
    // YYYY-MM-DD (String, como BggPlay.date). null = nunca jugado (solo en
    // colección) → ordena al fondo en el sort desc.
    lastPlayedDate: { type: String, default: null },
    owned: { type: Boolean, default: false },
    // Nombre normalizado (NFD strip + lowercase) para búsqueda accent/case
    // insensitive. Lo setea el rebuild (bulkWrite no dispara pre-save hooks).
    searchName: { type: String, default: "" },
  },
  { timestamps: true },
);

// Una fila por usuario-juego.
bggUserGameSchema.index({ bggUsername: 1, gameId: 1 }, { unique: true });
// Sort/paginación por defecto: recencia desc (null al fondo) → numPlays →
// nombre → gameId (orden total determinista, sin drift de paginación).
bggUserGameSchema.index({
  bggUsername: 1,
  lastPlayedDate: -1,
  numPlays: -1,
  name: 1,
  gameId: 1,
});
// Búsqueda por nombre normalizado.
bggUserGameSchema.index({ bggUsername: 1, searchName: 1 });

module.exports = mongoose.model("BggUserGame", bggUserGameSchema);
