/**
 * Seed de escenarios de Math Trade para inspección manual.
 *
 * Crea 10 casos (+1 bonus cancelado) que cubren todos los estados y los dos
 * modos de matching. NO borra nada al final (salvo corridas previas de este
 * mismo script, identificadas por el prefijo del título). NO toca otros datos
 * como tu "Test trade".
 *
 * Correr:  node scripts/seed-mathtrade-scenarios.js
 * Limpiar: node scripts/seed-mathtrade-scenarios.js --clean
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const MathTrade = require("../models/MathTrade");
const MathTradeItem = require("../models/MathTradeItem");
const { runMatching } = require("../services/mathTradeService");
const { loadSiteConfig, updateSiteConfig } = require("../utils/siteConfig");

const TEST_EMAIL = "claudiohollman+5@gmail.com";
const PREFIX = "Caso"; // los títulos arrancan con "Caso N ·" o "Bonus ·"

const GAMES = {
  1: "Catan",
  2: "Wingspan",
  3: "Azul",
  4: "Carcassonne",
  5: "Brass: Birmingham",
  6: "Scythe",
  7: "Gloomhaven",
  8: "Terraforming Mars",
  9: "Root",
  10: "Spirit Island",
  99: "Juego inexistente (nadie lo ofrece)",
};

const g = (id) => ({
  bggGameId: id,
  gameName: GAMES[id] || `Juego #${id}`,
  rank: 1,
});

let createdBy; // admin/test user id
const userCache = new Map();

async function ensureUser(key) {
  if (userCache.has(key)) return userCache.get(key);
  const email = `${key}@mt-sim.local`;
  let u = await User.findOne({ email });
  if (!u) {
    u = await User.create({
      username: key,
      email,
      password: "Password123!",
      emailVerified: true,
    });
  }
  userCache.set(key, u);
  return u;
}

// Crea un trade + sus ítems. `items` = [{ ownerKey, offer, wants:[ids] }].
// ownerKey 'me' = el user de prueba.
async function makeTrade({
  title,
  description,
  status,
  mode,
  maxChainLength,
  items = [],
  publish = false,
}) {
  const mt = await MathTrade.create({
    title,
    description,
    status: status === "open" || status === "draft" ? status : "locked", // se ajusta abajo
    matching: { mode: mode || "max", maxChainLength: maxChainLength || 4 },
    createdBy,
  });

  for (const it of items) {
    const owner =
      it.ownerKey === "me" ? { _id: createdBy } : await ensureUser(it.ownerKey);
    const off = g(it.offer);
    await MathTradeItem.create({
      mathtrade: mt._id,
      owner: owner._id,
      bggGameId: off.bggGameId,
      gameName: off.gameName,
      thumbnail: "",
      wants: it.wants.map((id) => g(id)),
    });
  }

  // Estados que requieren correr el matching.
  if (["results", "finished"].includes(status)) {
    await runMatching(mt._id, { mode, maxChainLength });
    await MathTrade.findByIdAndUpdate(mt._id, {
      $set: { status, published: true },
    });
  } else {
    await MathTrade.findByIdAndUpdate(mt._id, { $set: { status } });
  }

  const fresh = await MathTrade.findById(mt._id).lean();
  return fresh;
}

async function clean() {
  const trades = await MathTrade.find({
    title: { $regex: /^(Caso|Bonus)/ },
  }).lean();
  for (const t of trades) {
    await MathTradeItem.deleteMany({ mathtrade: t._id });
    await MathTrade.deleteOne({ _id: t._id });
  }
  return trades.length;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  // El user de prueba pasa a admin para poder ver TODO (drafts + sección).
  const me = await User.findOneAndUpdate(
    { email: TEST_EMAIL },
    { isAdmin: true },
    { new: true },
  );
  if (!me) throw new Error(`No existe el user de prueba ${TEST_EMAIL}`);
  createdBy = me._id;

  // Habilitar la sección en SiteConfig (best-effort; el admin igual la ve).
  try {
    await loadSiteConfig();
    await updateSiteConfig({ mathtrade: { enabled: true } }, me._id, null);
  } catch (_) {
    /* noop */
  }

  const removed = await clean();

  if (process.argv.includes("--clean")) {
    console.log(`Limpiados ${removed} trades de escenarios. Listo.`);
    await mongoose.disconnect();
    return;
  }

  const results = [];

  // 1 · Borrador (admin armando, sin ítems)
  results.push(
    await makeTrade({
      title: "Caso 1 · Borrador",
      description: "Borrador en armado. Solo visible para admins.",
      status: "draft",
      items: [],
    }),
  );

  // 2 · Abierto sin ofertas (empty state)
  results.push(
    await makeTrade({
      title: "Caso 2 · Abierto sin ofertas",
      description: "Inscripción abierta, todavía nadie cargó juegos.",
      status: "open",
      items: [],
    }),
  );

  // 3 · Abierto recibiendo ofertas
  results.push(
    await makeTrade({
      title: "Caso 3 · Abierto con ofertas",
      description: "Inscripción abierta con ofertas cargadas (sin matchear).",
      status: "open",
      items: [
        { ownerKey: "me", offer: 1, wants: [2, 3] },
        { ownerKey: "mt_sim_1", offer: 2, wants: [1] },
        { ownerKey: "mt_sim_2", offer: 3, wants: [1] },
      ],
    }),
  );

  // 4 · Cerrado, pendiente de matchear
  results.push(
    await makeTrade({
      title: "Caso 4 · Cerrado (pendiente de matchear)",
      description: "Inscripción cerrada. Admin todavía no corrió el matching.",
      status: "locked",
      items: [
        { ownerKey: "mt_sim_1", offer: 1, wants: [2] },
        { ownerKey: "mt_sim_2", offer: 2, wants: [1] },
      ],
    }),
  );

  // 5 · Resultados · 2-ciclo (max) — el user de prueba participa
  results.push(
    await makeTrade({
      title: "Caso 5 · Resultados · 2-ciclo",
      description: "Intercambio recíproco simple A↔B (modo cadena máxima).",
      status: "results",
      mode: "max",
      items: [
        { ownerKey: "me", offer: 1, wants: [2] },
        { ownerKey: "mt_sim_1", offer: 2, wants: [1] },
      ],
    }),
  );

  // 6 · Resultados · 3-ciclo (max) — el user de prueba participa
  results.push(
    await makeTrade({
      title: "Caso 6 · Resultados · 3-ciclo",
      description: "Cadena de 3 personas A→B→C→A (modo cadena máxima).",
      status: "results",
      mode: "max",
      items: [
        { ownerKey: "me", offer: 1, wants: [2] },
        { ownerKey: "mt_sim_1", offer: 2, wants: [3] },
        { ownerKey: "mt_sim_2", offer: 3, wants: [1] },
      ],
    }),
  );

  // 7 · Resultados · cadena acotada K=2 sobre un 3-ciclo → 0 intercambios
  results.push(
    await makeTrade({
      title: "Caso 7 · Resultados · acotado K=2 (no matchea el 3-ciclo)",
      description:
        "Mismo 3-ciclo que el caso 6 pero con máx. cadena = 2: no se puede armar, 0 intercambios.",
      status: "results",
      mode: "bounded",
      maxChainLength: 2,
      items: [
        { ownerKey: "mt_sim_3", offer: 1, wants: [2] },
        { ownerKey: "mt_sim_4", offer: 2, wants: [3] },
        { ownerKey: "mt_sim_5", offer: 3, wants: [1] },
      ],
    }),
  );

  // 8 · Resultados · cadena acotada K=3 sobre el mismo 3-ciclo → 3 intercambios
  results.push(
    await makeTrade({
      title: "Caso 8 · Resultados · acotado K=3 (sí matchea)",
      description:
        "Mismo 3-ciclo pero con máx. cadena = 3: se arma la cadena completa.",
      status: "results",
      mode: "bounded",
      maxChainLength: 3,
      items: [
        { ownerKey: "mt_sim_3", offer: 1, wants: [2] },
        { ownerKey: "mt_sim_4", offer: 2, wants: [3] },
        { ownerKey: "mt_sim_5", offer: 3, wants: [1] },
      ],
    }),
  );

  // 9 · Resultados · mixto (2 cadenas + ítems sin match) — parcial
  results.push(
    await makeTrade({
      title: "Caso 9 · Resultados · mixto con sin-match",
      description:
        "Dos 2-ciclos + un 3-ciclo + ítems que no matchean (querés algo que nadie ofrece / nadie quiere lo tuyo).",
      status: "results",
      mode: "max",
      items: [
        // 2-ciclo con el user de prueba
        { ownerKey: "me", offer: 1, wants: [2] },
        { ownerKey: "mt_sim_1", offer: 2, wants: [1] },
        // 2-ciclo
        { ownerKey: "mt_sim_2", offer: 3, wants: [4] },
        { ownerKey: "mt_sim_3", offer: 4, wants: [3] },
        // 3-ciclo
        { ownerKey: "mt_sim_4", offer: 5, wants: [6] },
        { ownerKey: "mt_sim_5", offer: 6, wants: [7] },
        { ownerKey: "mt_sim_6", offer: 7, wants: [5] },
        // sin match: quiere un juego que nadie ofrece
        { ownerKey: "mt_sim_7", offer: 8, wants: [99] },
        // sin match: ofrece algo que nadie quiere
        { ownerKey: "mt_sim_8", offer: 10, wants: [8] },
      ],
    }),
  );

  // 10 · Finalizado (archivado, con resultados)
  results.push(
    await makeTrade({
      title: "Caso 10 · Finalizado",
      description: "Intercambio ya cerrado y archivado, con resultados.",
      status: "finished",
      mode: "max",
      items: [
        { ownerKey: "mt_sim_1", offer: 1, wants: [2] },
        { ownerKey: "mt_sim_2", offer: 2, wants: [3] },
        { ownerKey: "mt_sim_3", offer: 3, wants: [1] },
      ],
    }),
  );

  // Bonus · Cancelado
  results.push(
    await makeTrade({
      title: "Bonus · Cancelado",
      description: "Intercambio cancelado por el organizador.",
      status: "cancelled",
      items: [{ ownerKey: "mt_sim_1", offer: 1, wants: [2] }],
    }),
  );

  console.log("\n=== Escenarios creados ===");
  for (const t of results) {
    const s = t.summary || {};
    console.log(
      `${t.title.padEnd(48)} | ${String(t.status).padEnd(10)} | ` +
        `tradeados ${s.itemsTraded ?? 0}/${s.itemsOffered ?? 0} | cadenas ${s.cyclesCount ?? 0}`,
    );
  }
  console.log(`\nUser de prueba (${TEST_EMAIL}) → isAdmin: true`);
  console.log("Sección mathtrade habilitada. Entrá y mirá /math-trade.\n");

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
