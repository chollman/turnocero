const mongoose = require("mongoose");

const mathTradeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    image: {
      url: { type: String },
      publicId: { type: String },
    },

    // draft     → admin lo arma
    // open      → usuarios cargan ofertas + want lists (hasta submissionDeadline)
    // locked    → inscripción cerrada, admin corre el matching
    // results   → resultados publicados
    // finished  → cerrado
    // cancelled → cancelado
    status: {
      type: String,
      enum: ["draft", "open", "locked", "results", "finished", "cancelled"],
      default: "draft",
      index: true,
    },

    submissionDeadline: { type: Date, default: null },

    // Configuración del algoritmo de matching.
    //   mode 'max'     → maximizar ítems intercambiados, cadenas de cualquier largo
    //   mode 'bounded' → ningún ciclo con más de `maxChainLength` personas
    //   mode 'auto'    → maximiza intercambios usando la cadena más corta que no
    //                    pierde intercambios significativos (elige el largo solo)
    matching: {
      mode: { type: String, enum: ["max", "bounded", "auto"], default: "max" },
      maxChainLength: { type: Number, min: 2, max: 12, default: 4 },
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Última corrida del matching y si los resultados ya fueron publicados.
    lastRunAt: { type: Date, default: null },
    published: { type: Boolean, default: false },

    // Resumen de la última corrida (se recalcula en cada run / clearResults).
    summary: {
      type: new mongoose.Schema(
        {
          itemsOffered: { type: Number, default: 0 },
          itemsTraded: { type: Number, default: 0 },
          cyclesCount: { type: Number, default: 0 },
          longestCycle: { type: Number, default: 0 },
          approximate: { type: Boolean, default: false },
          // Largo de cadena efectivamente usado (lo elige el modo auto;
          // null = cadena ilimitada).
          chosenChainLength: { type: Number, default: null },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
  },
  { timestamps: true },
);

mathTradeSchema.index({ status: 1, createdAt: -1 });
mathTradeSchema.index({ createdBy: 1 });

module.exports = mongoose.model("MathTrade", mathTradeSchema);
