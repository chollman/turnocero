const request = require("supertest");
const app = require("../../app");
const BggUsageDaily = require("../../models/BggUsageDaily");
const BggUsageEvent = require("../../models/BggUsageEvent");
const BggGame = require("../../models/BggGame");
const { createAuthedUser } = require("../helpers/auth");
const { dayKeyAR, subtractDays } = require("../../utils/dayKey");

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

describe("GET /api/admin/bgg-usage", () => {
  it("401 sin auth", async () => {
    const res = await request(app).get("/api/admin/bgg-usage");
    expect(res.status).toBe(401);
  });

  it("403 para no-admin", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .get("/api/admin/bgg-usage")
      .set(bearer(token));
    expect(res.status).toBe(403);
  });

  it("agrega lecturas/syncs/mutaciones por usuario + totales", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const { user: alice } = await createAuthedUser({
      username: "alice_u",
      bggUsername: "alice",
    });
    const today = dayKeyAR();
    await BggUsageDaily.create({
      day: today,
      userId: alice._id,
      reads: 10,
      readsByEndpoint: { search: 4, thing: 6, plays: 0, collection: 0, other: 0 },
      syncs: 1,
      mutations: { created: 2, edited: 1, deleted: 0 },
    });
    await BggUsageDaily.create({ day: today, userId: null, reads: 5 });

    const res = await request(app)
      .get("/api/admin/bgg-usage")
      .set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.totals.reads).toBe(15);
    expect(res.body.totals.created).toBe(2);
    expect(res.body.totals.syncs).toBe(1);

    const aliceRow = res.body.perUser.find((r) => r.user?.username === "alice_u");
    expect(aliceRow.reads).toBe(10);
    expect(aliceRow.byEndpoint.thing).toBe(6);
    expect(aliceRow.bggUsername).toBe("alice");
    expect(aliceRow.mutations.created).toBe(2);

    const anonRow = res.body.perUser.find((r) => r.user === null);
    expect(anonRow.reads).toBe(5);

    expect(res.body.byDay.find((d) => d.day === today).reads).toBe(15);
  });

  it("respeta el rango por defecto (últimos 7 días)", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const today = dayKeyAR();
    const old = subtractDays(today, 30);
    await BggUsageDaily.create({ day: today, userId: null, reads: 3 });
    await BggUsageDaily.create({ day: old, userId: null, reads: 99 });

    const res = await request(app)
      .get("/api/admin/bgg-usage")
      .set(bearer(token));
    expect(res.body.totals.reads).toBe(3);
  });

  it("acota a un from/to explícito", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const today = dayKeyAR();
    const old = subtractDays(today, 30);
    await BggUsageDaily.create({ day: today, userId: null, reads: 3 });
    await BggUsageDaily.create({ day: old, userId: null, reads: 99 });

    const res = await request(app)
      .get("/api/admin/bgg-usage")
      .query({ from: old, to: old })
      .set(bearer(token));
    expect(res.body.totals.reads).toBe(99);
  });
});

describe("GET /api/admin/bgg-usage/events", () => {
  it("403 para no-admin", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .get("/api/admin/bgg-usage/events")
      .set(bearer(token));
    expect(res.status).toBe(403);
  });

  it("lista eventos con fallback de nombre de juego desde BggGame", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const { user: carl } = await createAuthedUser({
      username: "carl_u",
      bggUsername: "carl",
    });
    await BggGame.create({ gameId: 13, name: "Catan" });
    await BggUsageEvent.create({
      userId: carl._id,
      bggUsername: "carl",
      action: "create",
      playId: "1",
      gameId: "13",
      gameName: null,
    });
    await BggUsageEvent.create({
      userId: carl._id,
      bggUsername: "carl",
      action: "delete",
      playId: "2",
      gameId: "999",
      gameName: "Wingspan",
    });

    const res = await request(app)
      .get("/api/admin/bgg-usage/events")
      .set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);

    const created = res.body.events.find((e) => e.action === "create");
    expect(created.gameName).toBe("Catan"); // resuelto desde BggGame
    expect(created.user.username).toBe("carl_u");

    const deleted = res.body.events.find((e) => e.action === "delete");
    expect(deleted.gameName).toBe("Wingspan"); // guardado
  });

  it("filtra por action", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const { user } = await createAuthedUser({ bggUsername: "dee" });
    await BggUsageEvent.create({ userId: user._id, action: "create", playId: "1" });
    await BggUsageEvent.create({ userId: user._id, action: "edit", playId: "1" });

    const res = await request(app)
      .get("/api/admin/bgg-usage/events")
      .query({ action: "edit" })
      .set(bearer(token));
    expect(res.body.total).toBe(1);
    expect(res.body.events[0].action).toBe("edit");
  });
});
