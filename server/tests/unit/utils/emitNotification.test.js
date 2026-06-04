const emitNotification = require("../../../utils/emitNotification");
const { emitNotificationReq } = require("../../../utils/emitNotification");
const SiteConfig = require("../../../models/SiteConfig");
const {
  loadSiteConfig,
  updateSiteConfig,
} = require("../../../utils/siteConfig");
const { createUser } = require("../../helpers/auth");

async function enableAllSections() {
  const all = {};
  for (const key of SiteConfig.SECTION_KEYS) all[key] = { enabled: true };
  await loadSiteConfig();
  await updateSiteConfig(all, null, null);
}

function makeIo() {
  return {
    emitted: [],
    to(room) {
      const self = this;
      return {
        emit(event, payload) {
          self.emitted.push({ room, event, payload });
        },
      };
    },
  };
}

describe("emitNotification", () => {
  beforeEach(enableAllSections);

  it("persists the notification and emits to user:<id> room with notifId + count", async () => {
    const user = await createUser();
    const io = makeIo();
    const notif = await emitNotification({
      io,
      recipientId: user._id,
      type: "chat",
      fields: { tableId: "t1", tableName: "Mesa", lastSenderUsername: "a" },
      socketEvent: "chat:notification",
    });

    expect(notif).not.toBeNull();
    expect(notif.count).toBe(1);

    expect(io.emitted).toHaveLength(1);
    expect(io.emitted[0].room).toBe(`user:${user._id}`);
    expect(io.emitted[0].event).toBe("chat:notification");
    expect(io.emitted[0].payload).toMatchObject({
      tableId: "t1",
      tableName: "Mesa",
      lastSenderUsername: "a",
      notifId: notif._id.toString(),
      count: 1,
    });
    expect(io.emitted[0].payload.timestamp).toBeDefined();
  });

  it("includes the content community in the emit payload (tenant scoping)", async () => {
    const user = await createUser();
    const io = makeIo();
    await emitNotification({
      io,
      recipientId: user._id,
      type: "evento_confirmed",
      fields: { eventoId: "ev1", community: "comm-123" },
      socketEvent: "evento:notification",
    });
    expect(io.emitted[0].payload.community).toBe("comm-123");
  });

  it("emits community: null for personal types (no community)", async () => {
    const user = await createUser();
    const io = makeIo();
    await emitNotification({
      io,
      recipientId: user._id,
      type: "friend_request",
      fields: { fromUserId: "u2", fromUsername: "pal" },
      socketEvent: "friend:request",
    });
    expect(io.emitted[0].payload.community).toBeNull();
  });

  it("returns the absolute count from the server upsert (not relative)", async () => {
    const user = await createUser();
    const io = makeIo();
    await emitNotification({
      io,
      recipientId: user._id,
      type: "chat",
      fields: { tableId: "t1", tableName: "M", lastSenderUsername: "a" },
      socketEvent: "chat:notification",
    });
    await emitNotification({
      io,
      recipientId: user._id,
      type: "chat",
      fields: { tableId: "t1", tableName: "M", lastSenderUsername: "b" },
      socketEvent: "chat:notification",
    });
    const third = await emitNotification({
      io,
      recipientId: user._id,
      type: "chat",
      fields: { tableId: "t1", tableName: "M", lastSenderUsername: "c" },
      socketEvent: "chat:notification",
    });

    expect(third.count).toBe(3);
    expect(io.emitted[2].payload.count).toBe(3);
  });

  it("returns null and does NOT emit when the section is disabled for a non-admin", async () => {
    await updateSiteConfig({ mesas: { enabled: false } }, null, null);
    const user = await createUser({ isAdmin: false });
    const io = makeIo();
    const notif = await emitNotification({
      io,
      recipientId: user._id,
      type: "chat",
      fields: { tableId: "t1", tableName: "M", lastSenderUsername: "a" },
      socketEvent: "chat:notification",
    });
    expect(notif).toBeNull();
    expect(io.emitted).toHaveLength(0);
  });

  it("still emits for an admin even when the section is disabled (admin always receives)", async () => {
    await updateSiteConfig({ mesas: { enabled: false } }, null, null);
    const admin = await createUser({ isAdmin: true });
    const io = makeIo();
    const notif = await emitNotification({
      io,
      recipientId: admin._id,
      type: "chat",
      fields: { tableId: "t1", tableName: "M", lastSenderUsername: "a" },
      socketEvent: "chat:notification",
    });
    expect(notif).not.toBeNull();
    expect(io.emitted).toHaveLength(1);
  });

  it("supports a custom room override", async () => {
    const user = await createUser();
    const io = makeIo();
    await emitNotification({
      io,
      recipientId: user._id,
      type: "admin_chat",
      fields: { lastSenderUsername: "admin", lastMessagePreview: "hi" },
      socketEvent: "admin:message",
      room: "admin:room",
    });
    expect(io.emitted[0].room).toBe("admin:room");
  });

  it("passes through extra payload fields without persisting them", async () => {
    const user = await createUser();
    const io = makeIo();
    const notif = await emitNotification({
      io,
      recipientId: user._id,
      type: "chat",
      fields: { tableId: "t1", tableName: "M", lastSenderUsername: "a" },
      socketEvent: "chat:notification",
      extra: { messagePreview: "hello world" },
    });
    expect(io.emitted[0].payload.messagePreview).toBe("hello world");
    // Not persisted because not in fields:
    expect(notif.messagePreview).toBeUndefined();
  });

  it("skips emit when io is missing (still persists)", async () => {
    const user = await createUser();
    const notif = await emitNotification({
      io: null,
      recipientId: user._id,
      type: "chat",
      fields: { tableId: "t1", tableName: "M", lastSenderUsername: "a" },
      socketEvent: "chat:notification",
    });
    expect(notif).not.toBeNull();
    // No throw, no emit — the persistence side still works.
  });
});

describe("emitNotificationReq", () => {
  beforeEach(enableAllSections);

  it('pulls io from req.app.get("io") and emits', async () => {
    const user = await createUser();
    const io = makeIo();
    const req = { app: { get: (k) => (k === "io" ? io : null) } };
    await emitNotificationReq(
      req,
      user._id,
      "chat",
      { tableId: "t1", tableName: "M", lastSenderUsername: "a" },
      "chat:notification",
    );
    expect(io.emitted).toHaveLength(1);
    expect(io.emitted[0].payload.count).toBe(1);
  });
});
