const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../../app");
const Notification = require("../../models/Notification");
const {
  createUser,
  createAuthedUser,
  authHeader,
  makeFriends,
} = require("../helpers/auth");

// Regression: las rutas de "marcar leído" de DM y admin-chat deben resetear
// `count: 0` (no sólo `read: true`). `dm` y `admin_chat` son tipos AGGREGATING
// (saveNotification usa $inc). Sin el reset, el próximo evento hace $inc desde
// el count viejo y el badge se desincroniza. Ver contrato en
// routes/notifications.js y CLAUDE.md (notification contract).

describe("DM read endpoint resets notification count", () => {
  it("PATCH /api/dm/:userId/read sets count back to 0", async () => {
    const { user: bob, token: bobToken } = await createAuthedUser();
    const { user: alice, token: aliceToken } = await createAuthedUser();
    await makeFriends(bob, alice);

    // Alice envía 2 DMs a Bob → notif dm con count 2 (aggregating $inc).
    await request(app)
      .post(`/api/dm/${bob._id}`)
      .set(authHeader(aliceToken))
      .send({ content: "hola" });
    await request(app)
      .post(`/api/dm/${bob._id}`)
      .set(authHeader(aliceToken))
      .send({ content: "che" });

    let notif = await Notification.findOne({
      recipient: bob._id,
      type: "dm",
      fromUserId: alice._id.toString(),
    });
    expect(notif).toBeTruthy();
    expect(notif.count).toBe(2);

    // Bob marca la conversación como leída.
    const res = await request(app)
      .patch(`/api/dm/${alice._id}/read`)
      .set(authHeader(bobToken));
    expect(res.status).toBe(200);

    notif = await Notification.findOne({
      recipient: bob._id,
      type: "dm",
      fromUserId: alice._id.toString(),
    });
    expect(notif.read).toBe(true);
    // El bug: sin reset, count seguía en 2 y el próximo DM emitía count=3.
    expect(notif.count).toBe(0);
  });
});

describe("Admin chat read endpoint resets notification count", () => {
  it("PATCH /api/admin-chat/read sets count back to 0", async () => {
    const { user: admin1, token: admin1Token } = await createAuthedUser({
      isAdmin: true,
    });
    const { token: admin2Token } = await createAuthedUser({ isAdmin: true });

    // admin2 envía 2 mensajes → admin1 acumula notif admin_chat count 2.
    await request(app)
      .post("/api/admin-chat")
      .set(authHeader(admin2Token))
      .send({ content: "primero" });
    await request(app)
      .post("/api/admin-chat")
      .set(authHeader(admin2Token))
      .send({ content: "segundo" });

    let notif = await Notification.findOne({
      recipient: admin1._id,
      type: "admin_chat",
    });
    expect(notif).toBeTruthy();
    expect(notif.count).toBe(2);

    const res = await request(app)
      .patch("/api/admin-chat/read")
      .set(authHeader(admin1Token));
    expect(res.status).toBe(200);

    notif = await Notification.findOne({
      recipient: admin1._id,
      type: "admin_chat",
    });
    expect(notif.read).toBe(true);
    expect(notif.count).toBe(0);
  });
});
