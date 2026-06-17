const mongoose = require("mongoose");

// Contador diario de uso de BGG por usuario (rollup vivo, actualizado con
// `$inc` upsert). Una fila por (día AR, userId). `userId: null` = lecturas
// de visitantes anónimos (perfiles públicos de BG Watch sin login).
//
// - `reads`: llamadas salientes a la XML API de BGG atribuidas a un request
//   del usuario (búsquedas, detalles de juego, perfiles, páginas de sync).
// - `readsByEndpoint`: desglose de esas lecturas por tipo de endpoint.
// - `syncs`: reconciliaciones completas iniciadas (POST /api/bgg/sync).
// - `mutations`: altas/ediciones/borrados de partidas vía geekplay.php.
//
// El detalle itemizado de las mutaciones (qué partida, qué juego) vive en
// `BggUsageEvent`; acá solo guardamos los agregados para el reporte.

const bggUsageDailySchema = new mongoose.Schema(
  {
    day: { type: String, required: true }, // 'YYYY-MM-DD' (hora AR)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reads: { type: Number, default: 0 },
    readsByEndpoint: {
      search: { type: Number, default: 0 },
      thing: { type: Number, default: 0 },
      plays: { type: Number, default: 0 },
      collection: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    syncs: { type: Number, default: 0 },
    mutations: {
      created: { type: Number, default: 0 },
      edited: { type: Number, default: 0 },
      deleted: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

// Una fila por usuario y día. `userId: null` ocupa un único slot (anónimos).
bggUsageDailySchema.index({ day: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("BggUsageDaily", bggUsageDailySchema);
