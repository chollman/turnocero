/**
 * Cleanup de los casos SIMULADOS de Math Trade (datos de prueba sembrados por
 * seed-mathtrade-scenarios.js y seed-mathtrade-large.js).
 *
 * Identifica:
 *   - Trades cuyo título arranca con "Caso ", "Bonus ", "XL " o
 *     "Math Trade de verificación", + todos sus MathTradeItem.
 *   - Usuarios sintéticos con email @mt-sim.local (mt_sim_*, mt_xl_*).
 *
 * NO toca datos reales: tu "Test trade", trades creados desde la UI, ni
 * usuarios reales (el match es por prefijo de título y dominio de email).
 *
 * DRY-RUN por defecto (solo lista, no borra):
 *   node scripts/cleanup-mathtrade-sim.js
 *
 * Borrar de verdad:
 *   node scripts/cleanup-mathtrade-sim.js --yes
 *
 * Borrar + revertir el flag admin del usuario de prueba:
 *   node scripts/cleanup-mathtrade-sim.js --yes --revert-admin
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const MathTrade = require("../models/MathTrade");
const MathTradeItem = require("../models/MathTradeItem");

const TEST_EMAIL = "claudiohollman+5@gmail.com";
const TITLE_RE = /^(Caso |Bonus |XL |Math Trade de verificación)/;
const SYNTH_EMAIL_RE = /@mt-sim\.local$/;

(async () => {
  const apply = process.argv.includes("--yes");
  const revertAdmin = process.argv.includes("--revert-admin");

  await mongoose.connect(process.env.MONGODB_URI);

  const trades = await MathTrade.find({ title: TITLE_RE })
    .select("_id title status")
    .lean();
  const tradeIds = trades.map((t) => t._id);
  const itemCount = tradeIds.length
    ? await MathTradeItem.countDocuments({ mathtrade: { $in: tradeIds } })
    : 0;
  const users = await User.find({ email: SYNTH_EMAIL_RE })
    .select("_id username email")
    .lean();

  console.log(
    `\n${apply ? "== BORRANDO ==" : "== DRY-RUN (no borra nada — usá --yes para aplicar) =="}\n`,
  );
  console.log(`Trades simulados encontrados: ${trades.length}`);
  for (const t of trades) console.log(`  - [${t.status}] ${t.title}`);
  console.log(`Ítems asociados: ${itemCount}`);
  console.log(`Usuarios sintéticos (@mt-sim.local): ${users.length}`);

  if (!apply) {
    console.log("\nNada borrado. Re-corré con --yes para aplicar.\n");
    await mongoose.disconnect();
    return;
  }

  if (tradeIds.length) {
    await MathTradeItem.deleteMany({ mathtrade: { $in: tradeIds } });
    await MathTrade.deleteMany({ _id: { $in: tradeIds } });
  }
  if (users.length) {
    const uids = users.map((u) => u._id);
    // Por las dudas, limpiar cualquier ítem huérfano de estos usuarios.
    await MathTradeItem.deleteMany({ owner: { $in: uids } });
    await User.deleteMany({ _id: { $in: uids } });
  }
  if (revertAdmin) {
    await User.updateOne({ email: TEST_EMAIL }, { isAdmin: false });
    console.log(`isAdmin:false revertido en ${TEST_EMAIL}`);
  }

  console.log(
    `\nListo: ${trades.length} trades, ${itemCount} ítems, ${users.length} usuarios sintéticos borrados.\n`,
  );
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
