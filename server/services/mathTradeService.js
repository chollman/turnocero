// Business logic de Math Trade extraída del router: orquesta la corrida del
// matching (carga ítems → arma la entrada pura → llama al motor → persiste),
// el preview sin persistir, y el reseteo de resultados en back-transitions.
// Toca Mongo pero no Express (testeable directo).

const MathTrade = require("../models/MathTrade");
const MathTradeItem = require("../models/MathTradeItem");
const {
  solveUnbounded,
  solveBounded,
  solveAuto,
} = require("../utils/mathTradeMatching");

// Transiciones de estado permitidas. `cancelled` es alcanzable desde cualquier
// estado activo; `finished` y `cancelled` son terminales.
const VALID_TRANSITIONS = {
  draft: new Set(["open", "cancelled"]),
  open: new Set(["locked", "draft", "cancelled"]),
  locked: new Set(["open", "results", "cancelled"]),
  results: new Set(["finished", "locked", "cancelled"]),
  finished: new Set([]),
  cancelled: new Set([]),
};

const EMPTY_SUMMARY = {
  itemsOffered: 0,
  itemsTraded: 0,
  cyclesCount: 0,
  longestCycle: 0,
  approximate: false,
  chosenChainLength: null,
};

// MathTradeItem doc (lean o no) → forma pura que entiende el motor.
function buildEngineInput(items) {
  return items.map((it) => ({
    id: String(it._id),
    ownerId: String(it.owner?._id || it.owner),
    gameId: it.bggGameId,
    wants: (it.wants || []).map((w) => ({
      gameId: w.bggGameId,
      rank: w.rank,
    })),
  }));
}

function runEngine(input, { mode, maxChainLength }) {
  if (mode === "auto") return solveAuto(input, {});
  if (mode === "bounded") return solveBounded(input, maxChainLength);
  return solveUnbounded(input);
}

function resolveConfig(mt, overrides = {}) {
  return {
    mode: overrides.mode || mt.matching?.mode || "max",
    maxChainLength:
      overrides.maxChainLength || mt.matching?.maxChainLength || 4,
  };
}

// Corre el matching y PERSISTE los resultados en cada ítem + el summary del
// evento. Devuelve el summary. El bulkWrite sobrescribe los campos de
// resultado de todos los ítems actuales, así que no quedan refs viejas.
async function runMatching(mathTradeId, overrides = {}) {
  const mt = await MathTrade.findById(mathTradeId);
  if (!mt) throw new Error("Math trade no encontrado");

  const cfg = resolveConfig(mt, overrides);
  const items = await MathTradeItem.find({ mathtrade: mathTradeId }).lean();
  const result = runEngine(buildEngineInput(items), cfg);

  const byId = new Map(result.perItem.map((p) => [String(p.itemId), p]));
  const ops = items.map((it) => {
    const p = byId.get(String(it._id));
    return {
      updateOne: {
        filter: { _id: it._id },
        update: {
          $set: {
            traded: p.traded,
            givesToItem: p.traded ? p.givesToItem : null,
            receivesFromItem: p.traded ? p.receivesFromItem : null,
            matchedGameId: p.traded ? p.matchedGameId : null,
          },
        },
      },
    };
  });
  if (ops.length > 0) await MathTradeItem.bulkWrite(ops);

  mt.summary = result.summary;
  mt.lastRunAt = new Date();
  mt.matching = cfg;
  await mt.save();

  return result.summary;
}

// Corre el matching SIN persistir (dry-run del admin). Devuelve los ciclos
// enriquecidos con dueño + nombres de juego para que la UI los muestre.
async function previewMatching(mathTradeId, overrides = {}) {
  const mt = await MathTrade.findById(mathTradeId).lean();
  if (!mt) throw new Error("Math trade no encontrado");

  const cfg = resolveConfig(mt, overrides);
  const items = await MathTradeItem.find({ mathtrade: mathTradeId })
    .populate("owner", "username displayName avatar")
    .lean();
  const result = runEngine(buildEngineInput(items), cfg);

  return {
    summary: result.summary,
    cycles: enrichCycles(result.cycles, items),
    mode: cfg.mode,
    maxChainLength: cfg.maxChainLength,
  };
}

// Resetea los resultados de un evento (back-transitions results→locked,
// →draft, →cancelled). NO toca `published` salvo que se pida.
async function clearResults(mathTradeId, { resetPublished = true } = {}) {
  await MathTradeItem.updateMany(
    { mathtrade: mathTradeId },
    {
      $set: {
        traded: false,
        givesToItem: null,
        receivesFromItem: null,
        matchedGameId: null,
      },
    },
  );
  const set = { summary: { ...EMPTY_SUMMARY }, lastRunAt: null };
  if (resetPublished) set.published = false;
  await MathTrade.findByIdAndUpdate(mathTradeId, { $set: set });
}

// Reconstruye la vista de resultados desde los datos YA persistidos en los
// ítems (no vuelve a correr el motor). Camina la permutación `receivesFromItem`
// para rearmar los ciclos. Usado por GET /:id/results.
async function getResults(mathTradeId) {
  const items = await MathTradeItem.find({ mathtrade: mathTradeId })
    .populate("owner", "username displayName avatar")
    .lean();
  const byId = new Map(items.map((it) => [String(it._id), it]));

  const visited = new Set();
  const cycles = [];
  for (const it of items) {
    const start = String(it._id);
    if (visited.has(start) || !it.traded || !it.receivesFromItem) {
      visited.add(start);
      continue;
    }
    const nodes = [];
    let cur = start;
    while (!visited.has(cur)) {
      visited.add(cur);
      const node = byId.get(cur);
      if (!node || !node.traded || !node.receivesFromItem) break;
      nodes.push(node);
      cur = String(node.receivesFromItem);
    }
    if (nodes.length >= 2) {
      cycles.push({
        length: nodes.length,
        items: nodes.map((node) => {
          const recv = byId.get(String(node.receivesFromItem));
          return {
            itemId: String(node._id),
            owner: node.owner,
            gameId: node.bggGameId,
            gameName: node.gameName,
            thumbnail: node.thumbnail,
            receivesItemId: String(node.receivesFromItem),
            receivesGameId: node.matchedGameId,
            receivesGameName: recv?.gameName || "",
          };
        }),
      });
    }
  }
  return cycles;
}

// Anota cada nodo del ciclo con dueño + nombre/thumbnail del juego (snapshots
// del ítem) para el preview.
function enrichCycles(cycles, items) {
  const byId = new Map(items.map((it) => [String(it._id), it]));
  return cycles.map((c) => ({
    length: c.length,
    items: c.items.map((node) => {
      const it = byId.get(String(node.itemId));
      const recv = byId.get(String(node.receivesItemId));
      return {
        itemId: node.itemId,
        owner: it?.owner || null,
        gameId: node.gameId,
        gameName: it?.gameName || "",
        thumbnail: it?.thumbnail || "",
        receivesItemId: node.receivesItemId,
        receivesGameId: node.receivesGameId,
        receivesGameName: recv?.gameName || "",
      };
    }),
  }));
}

module.exports = {
  VALID_TRANSITIONS,
  EMPTY_SUMMARY,
  buildEngineInput,
  runMatching,
  previewMatching,
  clearResults,
  getResults,
};
