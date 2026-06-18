const pushService = require("../../../services/pushService");
const webpushConfig = require("../../../config/webpush");
const PushSubscription = require("../../../models/PushSubscription");
const { createUser } = require("../../helpers/auth");

// Guardamos los originales para restaurar después de cada test (mutamos el
// objeto exportado, igual que setup.js con cloudinary/email).
const origVapid = webpushConfig.vapidConfigured;
const origWebpush = webpushConfig.webpush;

let sendMock;

beforeEach(() => {
  webpushConfig.vapidConfigured = () => true;
  sendMock = vi.fn().mockResolvedValue({});
  webpushConfig.webpush = { sendNotification: sendMock };
});

afterEach(() => {
  webpushConfig.vapidConfigured = origVapid;
  webpushConfig.webpush = origWebpush;
});

async function makeSub(user, endpoint) {
  return PushSubscription.create({
    user: user._id,
    endpoint,
    keys: { p256dh: "p", auth: "a" },
  });
}

describe("services/pushService.sendToUser", () => {
  it("es no-op si VAPID no está configurado", async () => {
    webpushConfig.vapidConfigured = () => false;
    const user = await createUser();
    await makeSub(user, "https://push.example/1");
    const res = await pushService.sendToUser(user._id, { type: "dm" });
    expect(res).toEqual({ sent: 0, pruned: 0 });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("es no-op si el usuario no tiene suscripciones", async () => {
    const user = await createUser();
    const res = await pushService.sendToUser(user._id, { type: "dm" });
    expect(res).toEqual({ sent: 0, pruned: 0 });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("envía a cada suscripción del usuario con el payload serializado", async () => {
    const user = await createUser();
    await makeSub(user, "https://push.example/1");
    await makeSub(user, "https://push.example/2");

    const res = await pushService.sendToUser(user._id, { type: "dm", count: 2 });

    expect(res.sent).toBe(2);
    expect(sendMock).toHaveBeenCalledTimes(2);
    // body es el JSON string del payload
    const body = sendMock.mock.calls[0][1];
    expect(JSON.parse(body)).toEqual({ type: "dm", count: 2 });
    // TTL corto
    expect(sendMock.mock.calls[0][2]).toMatchObject({ TTL: 60 });
  });

  it("prunea la suscripción cuando el push service responde 410 (Gone)", async () => {
    const user = await createUser();
    await makeSub(user, "https://push.example/dead");
    await makeSub(user, "https://push.example/alive");

    sendMock.mockImplementation((sub) => {
      if (sub.endpoint.endsWith("/dead")) {
        const err = new Error("gone");
        err.statusCode = 410;
        return Promise.reject(err);
      }
      return Promise.resolve({});
    });

    const res = await pushService.sendToUser(user._id, { type: "dm" });

    expect(res.sent).toBe(1);
    expect(res.pruned).toBe(1);
    const remaining = await PushSubscription.find({ user: user._id }).lean();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].endpoint).toBe("https://push.example/alive");
  });

  it("prunea también en 404", async () => {
    const user = await createUser();
    await makeSub(user, "https://push.example/404");
    sendMock.mockRejectedValue(Object.assign(new Error("nf"), { statusCode: 404 }));
    const res = await pushService.sendToUser(user._id, { type: "dm" });
    expect(res.pruned).toBe(1);
    expect(await PushSubscription.countDocuments({ user: user._id })).toBe(0);
  });

  it("un error genérico (no 404/410) ni throwea ni prunea", async () => {
    const user = await createUser();
    await makeSub(user, "https://push.example/flaky");
    sendMock.mockRejectedValue(Object.assign(new Error("500"), { statusCode: 500 }));

    const res = await pushService.sendToUser(user._id, { type: "dm" });

    expect(res.sent).toBe(0);
    expect(res.pruned).toBe(0);
    expect(await PushSubscription.countDocuments({ user: user._id })).toBe(1);
  });
});
