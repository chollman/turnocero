const request = require("supertest");
const app = require("../../app");
const Notification = require("../../models/Notification");
const { createAuthedUser } = require("../helpers/auth");

describe("GET /api/notifications", () => {
  it("requires auth", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
  });

  it("returns the caller's notifications newest first, capped at limit", async () => {
    const { user, token } = await createAuthedUser();
    // Insert 5 notifications with staggered updatedAt
    for (let i = 0; i < 5; i++) {
      await Notification.create({
        recipient: user._id,
        type: "comment",
        tableId: `t${i}`,
        tableName: `Mesa ${i}`,
        updatedAt: new Date(Date.now() + i * 1000),
      });
    }
    const res = await request(app)
      .get("/api/notifications?limit=3")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    // Newest first
    expect(res.body[0].tableId).toBe("t4");
    expect(res.body[1].tableId).toBe("t3");
  });

  it("does not leak other users' notifications", async () => {
    const { user: mine, token } = await createAuthedUser();
    const { user: other } = await createAuthedUser();
    await Notification.create({
      recipient: mine._id,
      type: "comment",
      tableId: "mine",
    });
    await Notification.create({
      recipient: other._id,
      type: "comment",
      tableId: "other",
    });
    const res = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.length).toBe(1);
    expect(res.body[0].tableId).toBe("mine");
  });
});

describe("PATCH /api/notifications/read", () => {
  it("marks all unread as read when body is empty", async () => {
    const { user, token } = await createAuthedUser();
    await Notification.create({
      recipient: user._id,
      type: "comment",
      tableId: "t1",
      read: false,
    });
    await Notification.create({
      recipient: user._id,
      type: "comment",
      tableId: "t2",
      read: false,
    });

    await request(app)
      .patch("/api/notifications/read")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    const unreadCount = await Notification.countDocuments({
      recipient: user._id,
      read: false,
    });
    expect(unreadCount).toBe(0);
  });

  it("resets count: 0 when marking read (otherwise next $inc inflates the badge)", async () => {
    // Regresión: el bug que vio el user — count quedaba en 3 después de
    // markRead, llegaba un comment nuevo, saveNotification hacía
    // $inc count=4 + read=false, y el badge mostraba "4" con UNA notif nueva.
    const { user, token } = await createAuthedUser();
    await Notification.create({
      recipient: user._id,
      type: "compartida_comment",
      compartidaId: "c1",
      count: 3,
      read: false,
    });

    await request(app)
      .patch("/api/notifications/read")
      .set("Authorization", `Bearer ${token}`)
      .send({ compartidaId: "c1" });

    const notif = await Notification.findOne({
      recipient: user._id,
      compartidaId: "c1",
    });
    expect(notif.read).toBe(true);
    expect(notif.count).toBe(0);
  });

  it("marks only matching tableId as read", async () => {
    const { user, token } = await createAuthedUser();
    await Notification.create({
      recipient: user._id,
      type: "comment",
      tableId: "t1",
      read: false,
    });
    await Notification.create({
      recipient: user._id,
      type: "comment",
      tableId: "t2",
      read: false,
    });

    await request(app)
      .patch("/api/notifications/read")
      .set("Authorization", `Bearer ${token}`)
      .send({ tableId: "t1" });

    const ns = await Notification.find({ recipient: user._id });
    const t1 = ns.find((n) => n.tableId === "t1");
    const t2 = ns.find((n) => n.tableId === "t2");
    expect(t1.read).toBe(true);
    expect(t2.read).toBe(false);
  });

  it("marks only matching communityId as read", async () => {
    const { user, token } = await createAuthedUser();
    await Notification.create({
      recipient: user._id,
      type: "community_join_request",
      communityId: "cm1",
      count: 2,
      read: false,
    });
    await Notification.create({
      recipient: user._id,
      type: "community_join_request",
      communityId: "cm2",
      read: false,
    });

    await request(app)
      .patch("/api/notifications/read")
      .set("Authorization", `Bearer ${token}`)
      .send({ communityId: "cm1" });

    const ns = await Notification.find({ recipient: user._id });
    const a = ns.find((n) => n.communityId === "cm1");
    const b = ns.find((n) => n.communityId === "cm2");
    expect(a.read).toBe(true);
    expect(a.count).toBe(0);
    expect(b.read).toBe(false);
  });

  it("marks only matching eventoId as read (regression: eventoId was silently ignored, marking the whole inbox read)", async () => {
    const { user, token } = await createAuthedUser();
    await Notification.create({
      recipient: user._id,
      type: "evento_reminder",
      eventoId: "ev1",
      read: false,
    });
    const other = await Notification.create({
      recipient: user._id,
      type: "comment",
      tableId: "t9",
      read: false,
    });

    await request(app)
      .patch("/api/notifications/read")
      .set("Authorization", `Bearer ${token}`)
      .send({ eventoId: "ev1" });

    const ns = await Notification.find({ recipient: user._id });
    const ev = ns.find((n) => n.eventoId === "ev1");
    const untouched = ns.find(
      (n) => n._id.toString() === other._id.toString(),
    );
    expect(ev.read).toBe(true);
    expect(ev.count).toBe(0);
    expect(untouched.read).toBe(false);
  });
});

describe("PATCH /api/notifications/:id/read", () => {
  it("marks a single notification read by its own id and resets count", async () => {
    const { user, token } = await createAuthedUser();
    const notif = await Notification.create({
      recipient: user._id,
      type: "compartida_like",
      compartidaId: "c1",
      count: 5,
      read: false,
    });
    const other = await Notification.create({
      recipient: user._id,
      type: "comment",
      tableId: "t1",
      read: false,
    });

    const res = await request(app)
      .patch(`/api/notifications/${notif._id}/read`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const updated = await Notification.findById(notif._id);
    expect(updated.read).toBe(true);
    expect(updated.count).toBe(0);
    const untouched = await Notification.findById(other._id);
    expect(untouched.read).toBe(false);
  });

  it("returns 404 when marking another user's notification", async () => {
    const { token } = await createAuthedUser();
    const { user: other } = await createAuthedUser();
    const theirs = await Notification.create({
      recipient: other._id,
      type: "comment",
      tableId: "x",
      read: false,
    });
    const res = await request(app)
      .patch(`/api/notifications/${theirs._id}/read`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect((await Notification.findById(theirs._id)).read).toBe(false);
  });

  it("returns 400 on an invalid id", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .patch("/api/notifications/not-an-id/read")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("requires auth", async () => {
    const res = await request(app).patch(
      "/api/notifications/000000000000000000000000/read",
    );
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/notifications", () => {
  it("clears all the caller's notifications", async () => {
    const { user, token } = await createAuthedUser();
    await Notification.create({
      recipient: user._id,
      type: "comment",
      tableId: "t1",
    });
    await Notification.create({
      recipient: user._id,
      type: "comment",
      tableId: "t2",
    });
    await request(app)
      .delete("/api/notifications")
      .set("Authorization", `Bearer ${token}`);
    expect(await Notification.countDocuments({ recipient: user._id })).toBe(0);
  });
});

describe("DELETE /api/notifications/:id", () => {
  it("dismisses a single notification of the caller", async () => {
    const { user, token } = await createAuthedUser();
    const keep = await Notification.create({
      recipient: user._id,
      type: "comment",
      tableId: "keep",
    });
    const drop = await Notification.create({
      recipient: user._id,
      type: "comment",
      tableId: "drop",
    });
    const res = await request(app)
      .delete(`/api/notifications/${drop._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const remaining = await Notification.find({ recipient: user._id });
    expect(remaining.map((n) => n._id.toString())).toEqual([
      keep._id.toString(),
    ]);
  });

  it("returns 404 when dismissing another user's notification", async () => {
    const { token } = await createAuthedUser();
    const { user: other } = await createAuthedUser();
    const theirs = await Notification.create({
      recipient: other._id,
      type: "comment",
      tableId: "x",
    });
    const res = await request(app)
      .delete(`/api/notifications/${theirs._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    // No se borró.
    expect(await Notification.countDocuments({ recipient: other._id })).toBe(1);
  });

  it("returns 400 on an invalid id", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .delete("/api/notifications/not-an-id")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("requires auth", async () => {
    const res = await request(app).delete(
      "/api/notifications/000000000000000000000000",
    );
    expect(res.status).toBe(401);
  });
});
