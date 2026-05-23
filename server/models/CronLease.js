const mongoose = require("mongoose");

// Lease distribuido para cron jobs. Cuando hay más de una instancia del
// server corriendo (deploy rolling, restart con overlap, blue/green), los
// crons de ambas pueden disparar al mismo tiempo y procesar duplicado.
//
// Cada job tira un `findOneAndUpdate` con condición sobre `expiresAt`:
// si nadie tiene el lease O el que lo tiene venció, lo agarra. Si otra
// instancia ya lo tiene activo, recibe null y skipea silenciosamente.
//
// `expiresAt` con TTL index hace que Mongo limpie docs viejos solo —
// no necesitamos un sweep manual. La granularidad TTL de Mongo es ~60s,
// así que un lease puede sobrevivir hasta ~1 min después del expiresAt
// teórico; los expiresAt los seteamos generosos (5 min default) para que
// el TTL nunca corra antes que termine el job.

const cronLeaseSchema = new mongoose.Schema(
  {
    // Nombre del job ("eventoReminders", "closePastEventos", etc.).
    name: { type: String, required: true, unique: true },
    // Cuándo expira este lease — Mongo lo borra solo via TTL.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    // Identificador del proceso/host que lo tiene — informativo, útil para
    // debug ("¿quién está corriendo esto?").
    holder: { type: String, default: null },
    acquiredAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model("CronLease", cronLeaseSchema);
