const request = require("supertest");
const app = require("../../app");
const PushSubscription = require("../../models/PushSubscription");
const pushService = require("../../services/pushService");
const { createAuthedUser, authHeader } = require("../helpers/auth");

const validSub = {
  endpoint: "https://push.example.com/abc123",
  keys: { p256dh: "BPdh-key", auth: "auth-key" },
};

describe("POST /api/push/subscribe", () => {
  it("crea una suscripción para el usuario autenticado (201)", async () => {
    const { user, token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/push/subscribe")
      .set(authHeader(token))
      .send(validSub);

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);

    const rows = await PushSubscription.find({ user: user._id }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].endpoint).toBe(validSub.endpoint);
    expect(rows[0].keys.p256dh).toBe("BPdh-key");
  });

  it("upsert por endpoint: re-suscribir el mismo device no duplica", async () => {
    const { user, token } = await createAuthedUser();
    await request(app).post("/api/push/subscribe").set(authHeader(token)).send(validSub);
    await request(app)
      .post("/api/push/subscribe")
      .set(authHeader(token))
      .send({ ...validSub, keys: { p256dh: "NEW", auth: "auth2" } });

    const rows = await PushSubscription.find({ user: user._id }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].keys.p256dh).toBe("NEW");
  });

  it("reasigna la fila al nuevo usuario si el mismo endpoint se reusa (device compartido)", async () => {
    const a = await createAuthedUser();
    const b = await createAuthedUser();
    await request(app).post("/api/push/subscribe").set(authHeader(a.token)).send(validSub);
    await request(app).post("/api/push/subscribe").set(authHeader(b.token)).send(validSub);

    expect(await PushSubscription.countDocuments({})).toBe(1);
    const row = await PushSubscription.findOne({ endpoint: validSub.endpoint }).lean();
    expect(String(row.user)).toBe(b.user._id.toString());
  });

  it("valida el body (400 sin keys)", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/push/subscribe")
      .set(authHeader(token))
      .send({ endpoint: "https://push.example.com/x" });
    expect(res.status).toBe(400);
  });

  it("rechaza sin auth (401)", async () => {
    const res = await request(app).post("/api/push/subscribe").send(validSub);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/push/unsubscribe", () => {
  it("elimina la suscripción de este dispositivo", async () => {
    const { user, token } = await createAuthedUser();
    await request(app).post("/api/push/subscribe").set(authHeader(token)).send(validSub);

    const res = await request(app)
      .post("/api/push/unsubscribe")
      .set(authHeader(token))
      .send({ endpoint: validSub.endpoint });

    expect(res.status).toBe(200);
    expect(await PushSubscription.countDocuments({ user: user._id })).toBe(0);
  });

  it("está scopeado por usuario: no borra el device de otro", async () => {
    const a = await createAuthedUser();
    const b = await createAuthedUser();
    await request(app).post("/api/push/subscribe").set(authHeader(a.token)).send(validSub);

    // b intenta des-suscribir el endpoint de a
    const res = await request(app)
      .post("/api/push/unsubscribe")
      .set(authHeader(b.token))
      .send({ endpoint: validSub.endpoint });

    expect(res.status).toBe(200);
    expect(await PushSubscription.countDocuments({ endpoint: validSub.endpoint })).toBe(1);
  });

  it("rechaza sin auth (401)", async () => {
    const res = await request(app)
      .post("/api/push/unsubscribe")
      .send({ endpoint: validSub.endpoint });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/push/test", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("envía una push de prueba y devuelve el conteo (admin)", async () => {
    const { user, token } = await createAuthedUser({ isAdmin: true });
    const spy = vi
      .spyOn(pushService, "sendToUser")
      .mockResolvedValue({ sent: 2, pruned: 0 });

    const res = await request(app)
      .post("/api/push/test")
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, sent: 2, pruned: 0 });
    expect(spy).toHaveBeenCalledTimes(1);

    // Se envía al propio admin con el flag `test` (para que el SW lo muestre
    // aunque la app esté en foco) y copy de prueba.
    const [recipientId, payload] = spy.mock.calls[0];
    expect(String(recipientId)).toBe(user._id.toString());
    expect(payload).toMatchObject({ test: true, type: "test" });
  });

  it("devuelve sent:0 cuando no hay dispositivos suscriptos", async () => {
    // Sin VAPID configurado en tests, sendToUser real es un no-op {sent:0}.
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .post("/api/push/test")
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(0);
  });

  it("rechaza a usuarios no-admin (403)", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/push/test")
      .set(authHeader(token));
    expect(res.status).toBe(403);
  });

  it("rechaza sin auth (401)", async () => {
    const res = await request(app).post("/api/push/test");
    expect(res.status).toBe(401);
  });
});
