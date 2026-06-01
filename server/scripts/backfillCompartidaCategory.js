/**
 * One-shot backfill: marca todas las compartidas existentes (sin `category`)
 * como `juntada`.
 *
 * Context: al introducir reseñas/juntadas, el campo `category` tiene default
 * "juntada", así que los docs viejos ya se leen como juntada sin migrar. Este
 * script solo los hace explícitos/queryables. Es idempotente — correrlo de
 * más no hace nada.
 *
 * Run once per environment:
 *   node server/scripts/backfillCompartidaCategory.js
 */

require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});
const mongoose = require("mongoose");
const Compartida = require("../models/Compartida");

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set. Aborting.");
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");
    const res = await Compartida.updateMany(
      { category: { $exists: false } },
      { $set: { category: "juntada" } },
    );
    console.log(
      `Backfilled ${res.modifiedCount} compartida(s) → category=juntada`,
    );
  } catch (err) {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected");
  }
})();
