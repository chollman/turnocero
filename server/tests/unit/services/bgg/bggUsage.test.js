const mongoose = require("mongoose");
const BggUsageDaily = require("../../../../models/BggUsageDaily");
const BggUsageEvent = require("../../../../models/BggUsageEvent");
const {
  classifyEndpoint,
  createUsageContext,
  runWithUsageContext,
  noteRead,
  flushReads,
  recordMutation,
  recordSync,
} = require("../../../../services/bgg/bggUsage");
const { dayKeyAR } = require("../../../../utils/dayKey");

const BASE = "https://boardgamegeek.com/xmlapi2";

describe("classifyEndpoint", () => {
  it("clasifica los endpoints conocidos de BGG", () => {
    expect(classifyEndpoint(`${BASE}/search?query=x`)).toBe("search");
    expect(classifyEndpoint(`${BASE}/thing?id=13`)).toBe("thing");
    expect(classifyEndpoint(`${BASE}/collection?username=a`)).toBe("collection");
    expect(classifyEndpoint(`${BASE}/plays?username=a`)).toBe("plays");
  });

  it("cae a 'other' para lo desconocido o vacío", () => {
    expect(classifyEndpoint(`${BASE}/hot`)).toBe("other");
    expect(classifyEndpoint("")).toBe("other");
  });
});

describe("noteRead + flushReads", () => {
  it("es no-op fuera de un request context", () => {
    expect(() => noteRead(`${BASE}/thing?id=1`)).not.toThrow();
  });

  it("acumula lecturas en el ALS y vuelca un doc diario", async () => {
    const userId = new mongoose.Types.ObjectId();
    const ctx = createUsageContext();
    runWithUsageContext(ctx, () => {
      noteRead(`${BASE}/search?query=catan`);
      noteRead(`${BASE}/thing?id=13`);
      noteRead(`${BASE}/thing?id=14`);
    });
    expect(ctx.reads).toBe(3);

    await flushReads(ctx, userId);
    const doc = await BggUsageDaily.findOne({ day: dayKeyAR(), userId });
    expect(doc.reads).toBe(3);
    expect(doc.readsByEndpoint.search).toBe(1);
    expect(doc.readsByEndpoint.thing).toBe(2);
  });

  it("incrementa el mismo doc diario en flushes sucesivos", async () => {
    const userId = new mongoose.Types.ObjectId();
    const ctx1 = createUsageContext();
    runWithUsageContext(ctx1, () => noteRead(`${BASE}/plays?username=a`));
    await flushReads(ctx1, userId);
    const ctx2 = createUsageContext();
    runWithUsageContext(ctx2, () => noteRead(`${BASE}/plays?username=a`));
    await flushReads(ctx2, userId);

    const doc = await BggUsageDaily.findOne({ day: dayKeyAR(), userId });
    expect(doc.reads).toBe(2);
    expect(doc.readsByEndpoint.plays).toBe(2);
    expect(await BggUsageDaily.countDocuments({ userId })).toBe(1);
  });

  it("agrupa las lecturas anónimas bajo userId null", async () => {
    const ctx = createUsageContext();
    runWithUsageContext(ctx, () => noteRead(`${BASE}/search?query=z`));
    await flushReads(ctx, null);
    const doc = await BggUsageDaily.findOne({ day: dayKeyAR(), userId: null });
    expect(doc.reads).toBe(1);
  });

  it("no escribe nada si no hubo lecturas", async () => {
    const userId = new mongoose.Types.ObjectId();
    const ctx = createUsageContext();
    await flushReads(ctx, userId);
    expect(await BggUsageDaily.countDocuments({ userId })).toBe(0);
  });
});

describe("recordMutation", () => {
  it("crea un evento y incrementa el contador diario", async () => {
    const user = { _id: new mongoose.Types.ObjectId(), bggUsername: "Alice" };
    await recordMutation(user, "create", {
      playId: "111",
      gameId: "13",
      gameName: "Catan",
    });
    const ev = await BggUsageEvent.findOne({ userId: user._id });
    expect(ev.action).toBe("create");
    expect(ev.playId).toBe("111");
    expect(ev.gameId).toBe("13");
    expect(ev.gameName).toBe("Catan");
    expect(ev.bggUsername).toBe("alice"); // lowercased

    const daily = await BggUsageDaily.findOne({ day: dayKeyAR(), userId: user._id });
    expect(daily.mutations.created).toBe(1);
  });

  it("mapea edit→edited y delete→deleted", async () => {
    const user = { _id: new mongoose.Types.ObjectId(), bggUsername: "bob" };
    await recordMutation(user, "edit", { playId: "1", gameId: "2" });
    await recordMutation(user, "delete", { playId: "1", gameId: "2" });
    const daily = await BggUsageDaily.findOne({ userId: user._id });
    expect(daily.mutations.edited).toBe(1);
    expect(daily.mutations.deleted).toBe(1);
    expect(await BggUsageEvent.countDocuments({ userId: user._id })).toBe(2);
  });

  it("ignora acciones desconocidas o user faltante", async () => {
    await expect(recordMutation(null, "create", {})).resolves.toBeUndefined();
    const user = { _id: new mongoose.Types.ObjectId(), bggUsername: "x" };
    await recordMutation(user, "bogus", {});
    expect(await BggUsageEvent.countDocuments({ userId: user._id })).toBe(0);
  });
});

describe("recordSync", () => {
  it("incrementa el contador de syncs", async () => {
    const user = { _id: new mongoose.Types.ObjectId() };
    await recordSync(user);
    await recordSync(user);
    const daily = await BggUsageDaily.findOne({ userId: user._id });
    expect(daily.syncs).toBe(2);
  });
});
