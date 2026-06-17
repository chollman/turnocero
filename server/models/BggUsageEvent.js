const mongoose = require("mongoose");

// Log itemizado de mutaciones de partidas que un usuario hace en BGG vía
// TurnoCero (crear / editar / borrar). Volumen bajo (nadie carga cientos de
// partidas por día) → sin TTL, conservamos el historial. `createdAt`
// (timestamps) es el momento del evento. El contador agregado para el
// reporte vive en `BggUsageDaily`; esta colección responde la pregunta
// "¿qué partidas cargó cada usuario y cuándo?".

const bggUsageEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bggUsername: { type: String, lowercase: true, trim: true, default: "" },
    action: {
      type: String,
      enum: ["create", "edit", "delete"],
      required: true,
    },
    playId: { type: String, default: null },
    gameId: { type: String, default: null },
    gameName: { type: String, default: null }, // best-effort; se resuelve al leer
  },
  { timestamps: true },
);

bggUsageEventSchema.index({ createdAt: -1 });
bggUsageEventSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("BggUsageEvent", bggUsageEventSchema);
