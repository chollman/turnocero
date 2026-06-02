/**
 * Seed de escenarios "grandes" de Math Trade: cada usuario ofrece 10-20 juegos,
 * con want lists de varios juegos. Sirve para ver el matching a escala (cadenas
 * largas, modo acotado, fallback aproximado).
 *
 * Prefijo de título "XL" — independiente del seed chico (prefijo "Caso"/"Bonus").
 * NO borra otros datos. Reproducible (PRNG con semilla por caso).
 *
 * Correr:  node scripts/seed-mathtrade-large.js
 * Limpiar: node scripts/seed-mathtrade-large.js --clean
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const MathTrade = require("../models/MathTrade");
const MathTradeItem = require("../models/MathTradeItem");
const { runMatching } = require("../services/mathTradeService");
const { loadSiteConfig, updateSiteConfig } = require("../utils/siteConfig");

const TEST_EMAIL = "claudiohollman+5@gmail.com";

// Pool de ~40 juegos (ids 101..140 para no chocar con el seed chico).
const GAME_NAMES = [
  "Catan",
  "Carcassonne",
  "Ticket to Ride",
  "Pandemic",
  "Azul",
  "Wingspan",
  "7 Wonders",
  "Dominion",
  "Terraforming Mars",
  "Scythe",
  "Gloomhaven",
  "Brass: Birmingham",
  "Root",
  "Spirit Island",
  "Everdell",
  "Ark Nova",
  "Dune: Imperium",
  "Cascadia",
  "Lost Ruins of Arnak",
  "Splendor",
  "Agricola",
  "Power Grid",
  "Concordia",
  "Great Western Trail",
  "Viticulture",
  "The Crew",
  "Patchwork",
  "Calico",
  "Res Arcana",
  "Clank!",
  "Eclipse",
  "Twilight Imperium",
  "Gaia Project",
  "Castles of Burgundy",
  "Puerto Rico",
  "Through the Ages",
  "El Grande",
  "Tigris & Euphrates",
  "Hansa Teutonica",
  "Food Chain Magnate",
];
const POOL = GAME_NAMES.map((name, i) => ({ id: 101 + i, name }));
const POOL_IDS = POOL.map((p) => p.id);
const NAME_BY_ID = new Map(POOL.map((p) => [p.id, p.name]));

const g = (id) => ({
  bggGameId: id,
  gameName: NAME_BY_ID.get(id) || `Juego #${id}`,
  rank: 1,
});

// PRNG determinístico (mulberry32).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickN(rand, arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}
const between = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

let createdBy;
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

// Genera ítems: cada usuario ofrece [minOffer..maxOffer] juegos distintos del
// pool, y cada ítem quiere [minWant..maxWant] juegos del pool (no los propios).
async function genItems(
  userKeys,
  seed,
  { minOffer, maxOffer, minWant, maxWant },
) {
  const rand = rng(seed);
  const items = [];
  for (const key of userKeys) {
    const owner = key === "me" ? { _id: createdBy } : await ensureUser(key);
    const q = between(rand, minOffer, maxOffer);
    const offers = pickN(rand, POOL_IDS, q);
    const ownSet = new Set(offers);
    for (const offerId of offers) {
      const wc = between(rand, minWant, maxWant);
      const wantPool = POOL_IDS.filter((id) => !ownSet.has(id));
      const wants = pickN(rand, wantPool, wc);
      items.push({
        owner: owner._id,
        bggGameId: offerId,
        gameName: NAME_BY_ID.get(offerId),
        thumbnail: "",
        wants: wants.map((id) => g(id)),
      });
    }
  }
  return items;
}

async function makeTrade({
  title,
  description,
  status,
  mode,
  maxChainLength,
  items,
}) {
  const mt = await MathTrade.create({
    title,
    description,
    status: status === "open" || status === "draft" ? status : "locked",
    matching: { mode: mode || "max", maxChainLength: maxChainLength || 4 },
    createdBy,
  });
  if (items.length) {
    await MathTradeItem.insertMany(
      items.map((it) => ({ ...it, mathtrade: mt._id })),
    );
  }
  if (["results", "finished"].includes(status)) {
    await runMatching(mt._id, { mode, maxChainLength });
    await MathTrade.findByIdAndUpdate(mt._id, {
      $set: { status, published: true },
    });
  } else {
    await MathTrade.findByIdAndUpdate(mt._id, { $set: { status } });
  }
  return MathTrade.findById(mt._id).lean();
}

const U = (n) => Array.from({ length: n }, (_, i) => `mt_xl_${i + 1}`);

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const me = await User.findOneAndUpdate(
    { email: TEST_EMAIL },
    { isAdmin: true },
    { new: true },
  );
  if (!me) throw new Error(`No existe el user de prueba ${TEST_EMAIL}`);
  createdBy = me._id;
  try {
    await loadSiteConfig();
    await updateSiteConfig({ mathtrade: { enabled: true } }, me._id, null);
  } catch (_) {
    /* noop */
  }

  // Limpia corridas previas de ESTE script (prefijo XL).
  const prev = await MathTrade.find({ title: { $regex: /^XL/ } }).lean();
  for (const t of prev) {
    await MathTradeItem.deleteMany({ mathtrade: t._id });
    await MathTrade.deleteOne({ _id: t._id });
  }
  if (process.argv.includes("--clean")) {
    console.log(`Limpiados ${prev.length} trades XL. Listo.`);
    await mongoose.disconnect();
    return;
  }

  // Definición de los 10 casos. perfil = rangos de oferta/want.
  const CASES = [
    {
      title: "XL 1 · Abierto · 6 users (10-15 c/u)",
      status: "open",
      mode: "max",
      users: U(6),
      seed: 1001,
      p: { minOffer: 10, maxOffer: 15, minWant: 3, maxWant: 5 },
    },
    {
      title: "XL 2 · Cerrado · 6 users (10-15 c/u)",
      status: "locked",
      mode: "max",
      users: U(6),
      seed: 1002,
      p: { minOffer: 10, maxOffer: 15, minWant: 3, maxWant: 5 },
    },
    {
      title: "XL 3 · Resultados · max · 6 users",
      status: "results",
      mode: "max",
      users: U(6),
      seed: 1003,
      p: { minOffer: 10, maxOffer: 15, minWant: 3, maxWant: 5 },
    },
    {
      title: "XL 4 · Resultados · acotado K=2 · 6 users",
      status: "results",
      mode: "bounded",
      maxChainLength: 2,
      users: U(6),
      seed: 1003,
      p: { minOffer: 10, maxOffer: 15, minWant: 3, maxWant: 5 },
    },
    {
      title: "XL 5 · Resultados · acotado K=3 · 6 users",
      status: "results",
      mode: "bounded",
      maxChainLength: 3,
      users: U(6),
      seed: 1003,
      p: { minOffer: 10, maxOffer: 15, minWant: 3, maxWant: 5 },
    },
    {
      title: "XL 6 · Resultados · acotado K=4 · 6 users",
      status: "results",
      mode: "bounded",
      maxChainLength: 4,
      users: U(6),
      seed: 1003,
      p: { minOffer: 10, maxOffer: 15, minWant: 3, maxWant: 5 },
    },
    {
      title: "XL 7 · Resultados · max · wants ESCASOS (1-2)",
      status: "results",
      mode: "max",
      users: U(8),
      seed: 1007,
      p: { minOffer: 10, maxOffer: 12, minWant: 1, maxWant: 2 },
    },
    {
      title: "XL 8 · Resultados · max · wants DENSOS (8-12)",
      status: "results",
      mode: "max",
      users: U(6),
      seed: 1008,
      p: { minOffer: 12, maxOffer: 15, minWant: 8, maxWant: 12 },
    },
    {
      title: "XL 9 · Resultados · acotado K=5 · MUY denso (aprox.)",
      status: "results",
      mode: "bounded",
      maxChainLength: 5,
      users: U(10),
      seed: 1009,
      p: { minOffer: 15, maxOffer: 20, minWant: 8, maxWant: 12 },
    },
    {
      title: "XL 10 · Resultados · max · grande + vos",
      status: "results",
      mode: "max",
      users: ["me", ...U(11)],
      seed: 1010,
      p: { minOffer: 10, maxOffer: 20, minWant: 4, maxWant: 8 },
    },
    {
      title: "XL 11 · Resultados · AUTO · denso (elige cadena corta)",
      status: "results",
      mode: "auto",
      users: U(10),
      seed: 1009,
      p: { minOffer: 15, maxOffer: 20, minWant: 8, maxWant: 12 },
    },
    {
      title: "XL 12 · Resultados · AUTO · grande + vos",
      status: "results",
      mode: "auto",
      users: ["me", ...U(11)],
      seed: 1010,
      p: { minOffer: 10, maxOffer: 20, minWant: 4, maxWant: 8 },
    },
  ];

  const out = [];
  for (const c of CASES) {
    const items = await genItems(c.users, c.seed, c.p);
    const t = await makeTrade({
      title: c.title,
      description:
        `${c.users.length} usuarios, ${items.length} ítems ofrecidos. ` +
        `Modo ${c.mode}${c.maxChainLength ? ` (K=${c.maxChainLength})` : ""}.`,
      status: c.status,
      mode: c.mode,
      maxChainLength: c.maxChainLength,
      items,
    });
    out.push({ t, users: c.users.length, items: items.length });
  }

  console.log("\n=== Escenarios XL creados ===");
  for (const { t, users, items } of out) {
    const s = t.summary || {};
    console.log(
      `${t.title.padEnd(52)} | ${String(t.status).padEnd(9)} | ` +
        `${users}u ${items}i | tradeados ${s.itemsTraded ?? 0} | ` +
        `cadenas ${s.cyclesCount ?? 0} | maxcad ${s.longestCycle ?? 0}` +
        `${s.chosenChainLength != null ? ` | autoK=${s.chosenChainLength}` : ""}` +
        `${s.approximate ? " | APROX" : ""}`,
    );
  }
  console.log("");
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
