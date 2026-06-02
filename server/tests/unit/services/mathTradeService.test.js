const mongoose = require("mongoose");
const MathTrade = require("../../../models/MathTrade");
const MathTradeItem = require("../../../models/MathTradeItem");
const { createUser } = require("../../helpers/auth");
const {
  VALID_TRANSITIONS,
  runMatching,
  previewMatching,
  clearResults,
} = require("../../../services/mathTradeService");

// Crea un math trade + 3 ítems formando un 3-ciclo (A→B→C→A por título).
async function seedThreeCycle() {
  const [u1, u2, u3] = await Promise.all([
    createUser(),
    createUser(),
    createUser(),
  ]);
  const mt = await MathTrade.create({
    title: "Trade test",
    createdBy: u1._id,
    status: "locked",
    matching: { mode: "max", maxChainLength: 4 },
  });
  const items = await MathTradeItem.create([
    {
      mathtrade: mt._id,
      owner: u1._id,
      bggGameId: 1,
      gameName: "G1",
      wants: [{ bggGameId: 2, gameName: "G2", rank: 1 }],
    },
    {
      mathtrade: mt._id,
      owner: u2._id,
      bggGameId: 2,
      gameName: "G2",
      wants: [{ bggGameId: 3, gameName: "G3", rank: 1 }],
    },
    {
      mathtrade: mt._id,
      owner: u3._id,
      bggGameId: 3,
      gameName: "G3",
      wants: [{ bggGameId: 1, gameName: "G1", rank: 1 }],
    },
  ]);
  return { mt, items, users: [u1, u2, u3] };
}

describe("VALID_TRANSITIONS", () => {
  it("permite el flujo draft → open → locked → results → finished", () => {
    expect(VALID_TRANSITIONS.draft.has("open")).toBe(true);
    expect(VALID_TRANSITIONS.open.has("locked")).toBe(true);
    expect(VALID_TRANSITIONS.locked.has("results")).toBe(true);
    expect(VALID_TRANSITIONS.results.has("finished")).toBe(true);
  });

  it("permite back-edges open→draft, locked→open, results→locked", () => {
    expect(VALID_TRANSITIONS.open.has("draft")).toBe(true);
    expect(VALID_TRANSITIONS.locked.has("open")).toBe(true);
    expect(VALID_TRANSITIONS.results.has("locked")).toBe(true);
  });

  it("permite cancelar desde cualquier estado activo", () => {
    ["draft", "open", "locked", "results"].forEach((s) =>
      expect(VALID_TRANSITIONS[s].has("cancelled")).toBe(true),
    );
  });

  it("finished y cancelled son terminales", () => {
    expect(VALID_TRANSITIONS.finished.size).toBe(0);
    expect(VALID_TRANSITIONS.cancelled.size).toBe(0);
  });

  it("prohíbe transiciones inválidas", () => {
    expect(VALID_TRANSITIONS.draft.has("results")).toBe(false);
    expect(VALID_TRANSITIONS.open.has("finished")).toBe(false);
  });
});

describe("runMatching", () => {
  it("persiste resultados por ítem y el summary del evento", async () => {
    const { mt } = await seedThreeCycle();
    const summary = await runMatching(mt._id, { mode: "max" });

    expect(summary.itemsTraded).toBe(3);
    expect(summary.cyclesCount).toBe(1);
    expect(summary.longestCycle).toBe(3);

    const items = await MathTradeItem.find({ mathtrade: mt._id }).lean();
    items.forEach((it) => {
      expect(it.traded).toBe(true);
      expect(it.receivesFromItem).not.toBeNull();
      expect(it.givesToItem).not.toBeNull();
      expect(it.matchedGameId).not.toBeNull();
    });

    const fresh = await MathTrade.findById(mt._id).lean();
    expect(fresh.summary.itemsTraded).toBe(3);
    expect(fresh.lastRunAt).not.toBeNull();
  });

  it("modo bounded K=2 no arma el 3-ciclo (0 intercambios)", async () => {
    const { mt } = await seedThreeCycle();
    const summary = await runMatching(mt._id, {
      mode: "bounded",
      maxChainLength: 2,
    });
    expect(summary.itemsTraded).toBe(0);
    const items = await MathTradeItem.find({ mathtrade: mt._id }).lean();
    items.forEach((it) => expect(it.traded).toBe(false));
  });

  it("modo auto elige la cadena más corta y persiste chosenChainLength", async () => {
    const { mt } = await seedThreeCycle();
    const summary = await runMatching(mt._id, { mode: "auto" });
    // Solo hay un 3-ciclo → auto sube a K=3.
    expect(summary.itemsTraded).toBe(3);
    expect(summary.chosenChainLength).toBe(3);
    const fresh = await MathTrade.findById(mt._id).lean();
    expect(fresh.summary.chosenChainLength).toBe(3);
  });

  it("tira si el math trade no existe", async () => {
    await expect(runMatching(new mongoose.Types.ObjectId())).rejects.toThrow();
  });
});

describe("previewMatching", () => {
  it("devuelve ciclos enriquecidos SIN persistir", async () => {
    const { mt } = await seedThreeCycle();
    const preview = await previewMatching(mt._id, { mode: "max" });

    expect(preview.summary.itemsTraded).toBe(3);
    expect(preview.cycles).toHaveLength(1);
    expect(preview.cycles[0].length).toBe(3);
    expect(preview.cycles[0].items[0].owner).toBeTruthy();
    expect(preview.cycles[0].items[0].gameName).toBeTruthy();

    // No se persistió nada.
    const items = await MathTradeItem.find({ mathtrade: mt._id }).lean();
    items.forEach((it) => expect(it.traded).toBe(false));
    const fresh = await MathTrade.findById(mt._id).lean();
    expect(fresh.lastRunAt).toBeNull();
  });
});

describe("clearResults", () => {
  it("resetea los campos de resultado y el summary", async () => {
    const { mt } = await seedThreeCycle();
    await runMatching(mt._id, { mode: "max" });
    await clearResults(mt._id);

    const items = await MathTradeItem.find({ mathtrade: mt._id }).lean();
    items.forEach((it) => {
      expect(it.traded).toBe(false);
      expect(it.givesToItem).toBeNull();
      expect(it.receivesFromItem).toBeNull();
    });
    const fresh = await MathTrade.findById(mt._id).lean();
    expect(fresh.summary.itemsTraded).toBe(0);
    expect(fresh.lastRunAt).toBeNull();
    expect(fresh.published).toBe(false);
  });
});
