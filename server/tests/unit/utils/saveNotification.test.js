const Notification = require("../../../models/Notification");
const saveNotification = require("../../../utils/saveNotification");
const SiteConfig = require("../../../models/SiteConfig");
const {
  loadSiteConfig,
  updateSiteConfig,
} = require("../../../utils/siteConfig");
const { createUser } = require("../../helpers/auth");

// All saveNotification tests except the section-gating block start with every
// section enabled, so the underlying upsert logic is exercised in isolation
// from the section-gating policy.
async function enableAllSections() {
  const all = {};
  for (const key of SiteConfig.SECTION_KEYS) all[key] = { enabled: true };
  await loadSiteConfig();
  await updateSiteConfig(all, null, null);
}

describe("saveNotification — aggregating types", () => {
  beforeEach(enableAllSections);

  it("inserts a new notification with count=1 on first call", async () => {
    const user = await createUser();
    const n = await saveNotification(user._id, "chat", {
      tableId: "t1",
      tableName: "Mesa Catán",
      lastSenderUsername: "cha",
    });
    expect(n).not.toBeNull();
    expect(n.count).toBe(1);
    expect(n.tableId).toBe("t1");
    expect(n.read).toBe(false);
  });

  it("increments count on subsequent calls for the same target", async () => {
    const user = await createUser();
    await saveNotification(user._id, "chat", {
      tableId: "t1",
      tableName: "Mesa",
      lastSenderUsername: "a",
    });
    await saveNotification(user._id, "chat", {
      tableId: "t1",
      tableName: "Mesa",
      lastSenderUsername: "b",
    });
    const n = await saveNotification(user._id, "chat", {
      tableId: "t1",
      tableName: "Mesa",
      lastSenderUsername: "c",
    });
    expect(n.count).toBe(3);
    expect(n.lastSenderUsername).toBe("c");
  });

  it("keeps separate notifications for different tableIds", async () => {
    const user = await createUser();
    await saveNotification(user._id, "comment", {
      tableId: "t1",
      lastCommenterUsername: "a",
    });
    await saveNotification(user._id, "comment", {
      tableId: "t2",
      lastCommenterUsername: "b",
    });
    const all = await Notification.find({
      recipient: user._id,
      type: "comment",
    });
    expect(all.length).toBe(2);
  });

  it("resets read=false on increment (even if previously read)", async () => {
    const user = await createUser();
    await saveNotification(user._id, "chat", {
      tableId: "t1",
      tableName: "Mesa",
    });
    await Notification.updateOne(
      { recipient: user._id, type: "chat", tableId: "t1" },
      { $set: { read: true } },
    );
    const after = await saveNotification(user._id, "chat", {
      tableId: "t1",
      tableName: "Mesa",
    });
    expect(after.read).toBe(false);
  });

  it("preserves tableName set on insert across increments", async () => {
    const user = await createUser();
    await saveNotification(user._id, "chat", {
      tableId: "t1",
      tableName: "Mesa Catán",
    });
    const after = await saveNotification(user._id, "chat", {
      tableId: "t1",
      tableName: "OTRO",
    });
    expect(after.tableName).toBe("Mesa Catán");
  });
});

describe("saveNotification — actors array", () => {
  beforeEach(enableAllSections);

  it("appends the actor newest-first, deduped by userId", async () => {
    const user = await createUser();
    await saveNotification(user._id, "join_request", {
      tableId: "t1",
      tableName: "Mesa",
      actor: { userId: "u1", username: "ana" },
    });
    await saveNotification(user._id, "join_request", {
      tableId: "t1",
      tableName: "Mesa",
      actor: { userId: "u2", username: "leo" },
    });
    // Mismo userId que el primero → no duplica, lo sube al frente.
    const n = await saveNotification(user._id, "join_request", {
      tableId: "t1",
      tableName: "Mesa",
      actor: { userId: "u1", username: "ana" },
    });
    expect(n.actors.map((a) => a.userId)).toEqual(["u1", "u2"]);
    expect(n.count).toBe(3);
  });

  it("caps the actors array at 8", async () => {
    const user = await createUser();
    for (let i = 0; i < 12; i += 1) {
      await saveNotification(user._id, "compartida_like", {
        compartidaId: "c1",
        actor: { userId: `u${i}`, username: `user${i}` },
      });
    }
    const n = await Notification.findOne({
      recipient: user._id,
      type: "compartida_like",
      compartidaId: "c1",
    });
    expect(n.actors.length).toBe(8);
    // El más nuevo (u11) queda primero.
    expect(n.actors[0].userId).toBe("u11");
  });

  it("does not break when no actor is passed (actors stays empty)", async () => {
    const user = await createUser();
    const n = await saveNotification(user._id, "chat", {
      tableId: "t1",
      tableName: "Mesa",
    });
    expect(n.actors).toEqual([]);
  });
});

describe("saveNotification — non-aggregating types", () => {
  beforeEach(enableAllSections);

  it("overwrites instead of incrementing for non-aggregating types", async () => {
    const user = await createUser();
    await saveNotification(user._id, "tournament_accepted", {
      torneoId: "tt1",
      torneoTitle: "Liga 1",
    });
    const n = await saveNotification(user._id, "tournament_accepted", {
      torneoId: "tt1",
      torneoTitle: "Liga 1 (renombrada)",
    });
    expect(n.count).toBe(1);
    expect(n.torneoTitle).toBe("Liga 1 (renombrada)");
  });
});

describe("saveNotification — section gating", () => {
  // No enableAllSections() here — these tests assert behavior when sections are OFF.
  beforeEach(async () => {
    await loadSiteConfig(); // section 'mesas' defaults to false
  });

  it("returns null and persists nothing when the section is disabled for non-admins", async () => {
    const user = await createUser({ isAdmin: false });
    const result = await saveNotification(user._id, "chat", { tableId: "t1" });
    expect(result).toBeNull();
    const count = await Notification.countDocuments({ recipient: user._id });
    expect(count).toBe(0);
  });

  it("still saves to admins when section is disabled (admins see through)", async () => {
    const admin = await createUser({ isAdmin: true });
    const result = await saveNotification(admin._id, "chat", { tableId: "t1" });
    expect(result).not.toBeNull();
    expect(result.count).toBe(1);
  });

  it("saves for everyone when the section is enabled", async () => {
    await updateSiteConfig({ mesas: { enabled: true } }, null, null);
    const user = await createUser({ isAdmin: false });
    const result = await saveNotification(user._id, "chat", { tableId: "t1" });
    expect(result).not.toBeNull();
  });
});

describe("saveNotification — evento types", () => {
  beforeEach(enableAllSections);

  it("persists evento_confirmed with eventoId/eventoTitle/eventoDate", async () => {
    const user = await createUser();
    const date = new Date("2027-06-13T20:00:00Z");
    const n = await saveNotification(user._id, "evento_confirmed", {
      eventoId: "ev1",
      eventoTitle: "Torneo Otoño",
      eventoDate: date,
    });
    expect(n).not.toBeNull();
    expect(n.eventoId).toBe("ev1");
    expect(n.eventoTitle).toBe("Torneo Otoño");
    expect(n.eventoDate?.toISOString()).toBe(date.toISOString());
    expect(n.count).toBe(1);
  });

  it("overwrites (no aggregating) on repeated calls for the same evento", async () => {
    const user = await createUser();
    await saveNotification(user._id, "evento_confirmed", {
      eventoId: "ev1",
      eventoTitle: "A",
    });
    const n = await saveNotification(user._id, "evento_confirmed", {
      eventoId: "ev1",
      eventoTitle: "B",
    });
    expect(n.count).toBe(1);
    expect(n.eventoTitle).toBe("B");
  });

  it("keeps separate notifications for different eventoIds", async () => {
    const user = await createUser();
    await saveNotification(user._id, "evento_reminder", {
      eventoId: "ev1",
      eventoTitle: "A",
    });
    await saveNotification(user._id, "evento_reminder", {
      eventoId: "ev2",
      eventoTitle: "B",
    });
    const all = await Notification.find({
      recipient: user._id,
      type: "evento_reminder",
    });
    expect(all.length).toBe(2);
  });

  it("persists permanentlyRejected flag on evento_rejected", async () => {
    const user = await createUser();
    const n = await saveNotification(user._id, "evento_rejected", {
      eventoId: "ev1",
      eventoTitle: "X",
      permanentlyRejected: true,
    });
    expect(n.permanentlyRejected).toBe(true);
  });

  it("persists changedFields array on evento_updated", async () => {
    const user = await createUser();
    const n = await saveNotification(user._id, "evento_updated", {
      eventoId: "ev1",
      eventoTitle: "X",
      changedFields: ["eventDate", "location"],
    });
    expect(n.changedFields).toEqual(["eventDate", "location"]);
  });

  it("respects section gating (eventos disabled → no persist for non-admins)", async () => {
    await updateSiteConfig({ eventos: { enabled: false } }, null, null);
    const user = await createUser({ isAdmin: false });
    const result = await saveNotification(user._id, "evento_confirmed", {
      eventoId: "ev1",
    });
    expect(result).toBeNull();
  });

  it("admins receive evento notifications even when section is off", async () => {
    await updateSiteConfig({ eventos: { enabled: false } }, null, null);
    const admin = await createUser({ isAdmin: true });
    const result = await saveNotification(admin._id, "evento_confirmed", {
      eventoId: "ev1",
    });
    expect(result).not.toBeNull();
  });
});
