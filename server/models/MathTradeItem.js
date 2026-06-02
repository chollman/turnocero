const mongoose = require("mongoose");

// Un want apunta a un TÍTULO de juego (bggGameId), no a una copia puntual.
// El matcher expande "quiero G" a cualquier copia ofrecida de G por otro dueño.
const wantSchema = new mongoose.Schema(
  {
    bggGameId: { type: Number, required: true },
    gameName: { type: String, default: "" },
    thumbnail: { type: String, default: "" },
    rank: { type: Number, default: 1, min: 1 }, // menor = más preferido
  },
  { _id: false },
);

// Un doc por juego ofrecido (una copia física = un ítem).
const mathTradeItemSchema = new mongoose.Schema(
  {
    mathtrade: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MathTrade",
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Juego ofrecido (snapshot BGG vía resolveGame al crear).
    bggGameId: { type: Number, required: true },
    gameName: { type: String, default: "" },
    thumbnail: { type: String, default: "" },

    wants: { type: [wantSchema], default: [] },
    notes: { type: String, trim: true, maxlength: 500, default: "" },

    // Resultado de la última corrida del matching.
    traded: { type: Boolean, default: false },
    givesToItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MathTradeItem",
      default: null,
    },
    receivesFromItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MathTradeItem",
      default: null,
    },
    matchedGameId: { type: Number, default: null },
  },
  { timestamps: true },
);

mathTradeItemSchema.index({ mathtrade: 1, owner: 1 });
mathTradeItemSchema.index({ mathtrade: 1, bggGameId: 1 });

module.exports = mongoose.model("MathTradeItem", mathTradeItemSchema);
