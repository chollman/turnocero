// eslint-disable-next-line no-warning-comments
/**
 * Seed + migración de la comunidad base "TurnoCero".
 *
 * Context: al introducir Comunidades (multi-tenancy suave), todo el contenido
 * histórico (Mesas, Compartidas, Eventos, Torneos, Noticias, MathTrade) y todos
 * los usuarios pasan a pertenecer a una comunidad base. Este script:
 *   1. Crea (upsert) la comunidad base.
 *   2. Backfillea `community = base` en todo el contenido sin comunidad,
 *      iterando el registro `scopedModels` (así modelos futuros quedan cubiertos).
 *   3. Agrega la membership base + setea el skin base en todos los usuarios.
 *
 * Es IDEMPOTENTE — correrlo de más no modifica nada (todos los modifiedCount 0).
 *
 * Run once per environment:
 *   node server/scripts/seed-base-community.js
 */

require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});
// Mismo escape-hatch que server.js: algunos DNS (ISP/router) no resuelven los
// registros SRV de `mongodb+srv://` (Atlas). DNS_SERVERS permite forzar un
// resolver público (ej. 8.8.8.8,1.1.1.1).
const dns = require("dns");
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()));
}
const mongoose = require("mongoose");
const Community = require("../models/Community");
const User = require("../models/User");
const SCOPED_MODELS = require("../config/scopedModels");

async function seedBaseCommunity() {
  // 1. Comunidad base (upsert idempotente).
  const base = await Community.ensureBase();
  console.log(`Base community: ${base.name} (${base._id})`);

  // 2. Backfill de contenido sin comunidad.
  const unscoped = {
    $or: [{ community: null }, { community: { $exists: false } }],
  };
  for (const { model, label } of SCOPED_MODELS) {
    const res = await model.updateMany(unscoped, {
      $set: { community: base._id },
    });
    console.log(`  ${label}: ${res.modifiedCount} backfilled`);
  }

  // 3. Backfill de usuarios: membership base + skin base. `viewing` queda
  //    vacío a propósito (= "todas las memberships" en lectura).
  const memRes = await User.updateMany(
    { "communityMemberships.community": { $ne: base._id } },
    { $push: { communityMemberships: { community: base._id, role: "member" } } },
  );
  const skinRes = await User.updateMany(
    {
      $or: [
        { "communityPrefs.skin": null },
        { "communityPrefs.skin": { $exists: false } },
      ],
    },
    { $set: { "communityPrefs.skin": base._id } },
  );
  console.log(
    `  Users: +${memRes.modifiedCount} membership, ${skinRes.modifiedCount} skin set`,
  );

  return base;
}

// Solo auto-ejecutar como script CLI; exportar la función para tests.
if (require.main === module) {
  (async () => {
    if (!process.env.MONGODB_URI) {
      console.error("MONGODB_URI is not set. Aborting.");
      process.exit(1);
    }
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("Connected to MongoDB");
      await seedBaseCommunity();
      console.log("Done.");
    } catch (err) {
      console.error("Seed failed:", err);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
      console.log("Disconnected");
    }
  })();
}

module.exports = { seedBaseCommunity };
