const mongoose = require("mongoose");
const Torneo = require("../../../models/Torneo");
const TorneoMatch = require("../../../models/TorneoMatch");
const TorneoGroup = require("../../../models/TorneoGroup");
const TorneoGame = require("../../../models/TorneoGame");
const {
  VALID_TRANSITIONS,
  buildAndInsertMatches,
  buildAndInsertGroupsForPhase,
  cascadeClearWinner,
  getFinalRound,
} = require("../../../services/torneoService");

const oid = () => new mongoose.Types.ObjectId();

function makeTorneo(overrides = {}) {
  return new Torneo({
    title: "Test Torneo",
    game: "Catan",
    format: "league",
    inscriptionMode: "admin_only",
    createdBy: oid(),
    participants: [],
    status: "draft",
    ...overrides,
  });
}

describe("VALID_TRANSITIONS", () => {
  it("permite draft → registration y draft → in_progress", () => {
    expect(VALID_TRANSITIONS.draft.has("registration")).toBe(true);
    expect(VALID_TRANSITIONS.draft.has("in_progress")).toBe(true);
  });

  it("permite registration → in_progress y registration → draft", () => {
    expect(VALID_TRANSITIONS.registration.has("in_progress")).toBe(true);
    expect(VALID_TRANSITIONS.registration.has("draft")).toBe(true);
  });

  it("permite in_progress → finished pero NO finished → cualquier cosa", () => {
    expect(VALID_TRANSITIONS.in_progress.has("finished")).toBe(true);
    expect(VALID_TRANSITIONS.finished.size).toBe(0);
  });

  it("prohíbe transiciones inválidas", () => {
    expect(VALID_TRANSITIONS.draft.has("finished")).toBe(false);
    expect(VALID_TRANSITIONS.registration.has("finished")).toBe(false);
    expect(VALID_TRANSITIONS.in_progress.has("draft")).toBe(false);
  });
});

describe("buildAndInsertMatches", () => {
  it("genera fixture de liga (round-robin) e inserta matches", async () => {
    const players = [oid(), oid(), oid(), oid()];
    const t = await makeTorneo({ participants: players }).save();

    const inserted = await buildAndInsertMatches(t);
    expect(inserted.length).toBeGreaterThan(0);
    // Liga 4-player = 6 matches (C(4,2)).
    expect(inserted).toHaveLength(6);

    const persisted = await TorneoMatch.find({ torneo: t._id });
    expect(persisted).toHaveLength(6);
  });

  it("genera bracket single_elim e inserta matches + patchea nextMatch refs", async () => {
    const players = [oid(), oid(), oid(), oid()];
    const t = await makeTorneo({
      format: "single_elim",
      participants: players,
    }).save();

    const inserted = await buildAndInsertMatches(t);
    // 4 jugadores = 3 matches en single_elim (2 semis + 1 final).
    expect(inserted).toHaveLength(3);

    // Las semis deben apuntar a la final via nextMatch.
    const semis = inserted.filter((m) => m.round === 1);
    const refreshed = await TorneoMatch.find({
      _id: { $in: semis.map((s) => s._id) },
    });
    refreshed.forEach((m) => {
      expect(m.nextMatch).toBeTruthy();
    });
  });

  it("tira si no se puede generar nada (sin participants)", async () => {
    const t = await makeTorneo({ participants: [] }).save();
    await expect(buildAndInsertMatches(t)).rejects.toThrow(/participantes/);
  });
});

describe("buildAndInsertGroupsForPhase", () => {
  it("crea grupos + games para la fase indicada", async () => {
    const playerIds = Array.from({ length: 8 }, () => oid());
    const t = await makeTorneo({
      format: "groups",
      participants: playerIds,
      tableSize: 4,
      gamesPerGroup: 3,
    }).save();

    const groups = await buildAndInsertGroupsForPhase(t, 1, playerIds);
    expect(groups).toHaveLength(2); // 8 jugadores / mesa de 4 = 2 mesas

    const persistedGroups = await TorneoGroup.find({
      torneo: t._id,
      phase: 1,
    });
    expect(persistedGroups).toHaveLength(2);
    persistedGroups.forEach((g) => {
      expect(g.players).toHaveLength(4);
      expect(g.advancedPlayers).toEqual([]);
      expect(g.status).toBe("in_progress");
    });

    // Cada grupo arranca con `gamesPerGroup` games pending.
    const games = await TorneoGame.find({ torneo: t._id });
    expect(games).toHaveLength(2 * 3);
    games.forEach((g) => {
      expect(g.status).toBe("pending");
      expect(g.results).toEqual([]);
    });
  });

  it("acepta tableSizeOverride para una fase específica", async () => {
    const playerIds = Array.from({ length: 6 }, () => oid());
    const t = await makeTorneo({
      format: "groups",
      participants: playerIds,
      tableSize: 4, // default
      gamesPerGroup: 1,
    }).save();

    // Override a 3 → 6 / 3 = 2 grupos.
    const groups = await buildAndInsertGroupsForPhase(t, 1, playerIds, 3);
    expect(groups).toHaveLength(2);
    groups.forEach((g) => expect(g.players).toHaveLength(3));
  });

  it("tira si no se puede armar layout (0 jugadores)", async () => {
    const t = await makeTorneo({
      format: "groups",
      participants: [],
      tableSize: 4,
    }).save();
    await expect(buildAndInsertGroupsForPhase(t, 1, [])).rejects.toThrow(
      /grupos/,
    );
  });
});

describe("cascadeClearWinner", () => {
  it("limpia el slot indicado en el match", async () => {
    const p1 = oid();
    const p2 = oid();
    const match = await TorneoMatch.create({
      torneo: oid(),
      round: 1,
      matchIndex: 0,
      playerA: p1,
      playerB: p2,
      winner: p1,
      status: "completed",
      isUpperSlot: true,
    });

    await cascadeClearWinner(match._id, "playerA");
    const updated = await TorneoMatch.findById(match._id);
    expect(updated.playerA).toBeNull();
    expect(updated.winner).toBeNull();
    expect(updated.status).toBe("pending");
    expect(updated.isDraw).toBe(false);
  });

  it("propaga la limpieza al match hijo (nextMatch) si dependía del winner", async () => {
    const torneoId = oid();
    const p1 = oid();
    const p2 = oid();

    // Final: depende del winner de match1 en slot playerA.
    const final = await TorneoMatch.create({
      torneo: torneoId,
      round: 2,
      matchIndex: 0,
      playerA: p1, // copia del winner de match1
      playerB: null,
      winner: null,
      status: "pending",
      isUpperSlot: true,
    });

    const semifinal = await TorneoMatch.create({
      torneo: torneoId,
      round: 1,
      matchIndex: 0,
      playerA: p1,
      playerB: p2,
      winner: p1,
      status: "completed",
      isUpperSlot: true, // su winner va al slot playerA del child
      nextMatch: final._id,
    });

    await cascadeClearWinner(semifinal._id, "playerA");

    const finalAfter = await TorneoMatch.findById(final._id);
    expect(finalAfter.playerA).toBeNull();

    const semiAfter = await TorneoMatch.findById(semifinal._id);
    expect(semiAfter.playerA).toBeNull();
    expect(semiAfter.winner).toBeNull();
  });

  it("es no-op si el match no existe", async () => {
    await expect(cascadeClearWinner(oid(), "playerA")).resolves.toBeUndefined();
  });
});

describe("getFinalRound", () => {
  it("devuelve 0 si el torneo no tiene matches", async () => {
    const torneoId = oid();
    expect(await getFinalRound(torneoId)).toBe(0);
  });

  it("devuelve el round más alto entre los matches del torneo", async () => {
    const torneoId = oid();
    await TorneoMatch.create({
      torneo: torneoId,
      round: 1,
      matchIndex: 0,
      status: "pending",
    });
    await TorneoMatch.create({
      torneo: torneoId,
      round: 3,
      matchIndex: 0,
      status: "pending",
    });
    await TorneoMatch.create({
      torneo: torneoId,
      round: 2,
      matchIndex: 0,
      status: "pending",
    });
    expect(await getFinalRound(torneoId)).toBe(3);
  });

  it("ignora matches de otros torneos", async () => {
    const mineId = oid();
    const otherId = oid();
    await TorneoMatch.create({
      torneo: mineId,
      round: 2,
      matchIndex: 0,
      status: "pending",
    });
    await TorneoMatch.create({
      torneo: otherId,
      round: 9,
      matchIndex: 0,
      status: "pending",
    });
    expect(await getFinalRound(mineId)).toBe(2);
  });
});
