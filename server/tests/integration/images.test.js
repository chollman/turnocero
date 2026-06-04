const request = require("supertest");
const app = require("../../app");
const Notification = require("../../models/Notification");
const { createUser, createAuthedUser } = require("../helpers/auth");
const { createTable } = require("../helpers/factories");
const { loadSiteConfig, updateSiteConfig } = require("../../utils/siteConfig");
const SiteConfig = require("../../models/SiteConfig");

async function enableAllSections() {
  const all = {};
  for (const key of SiteConfig.SECTION_KEYS) all[key] = { enabled: true };
  await loadSiteConfig();
  await updateSiteConfig(all, null, null);
}

beforeEach(enableAllSections);

// Buffer mínimo válido — Cloudinary upload está stubbeado, así que cualquier
// contenido sirve como long-tail del multipart.
const fakeImageBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);

describe("POST /api/tables/:id/images — notificación 'image' por privacy", () => {
  it("mesa pública: notifica a players + followers (sin uploader)", async () => {
    const player = await createUser();
    const follower = await createUser();
    const { user: host, token } = await createAuthedUser();
    const table = await createTable(host, {
      privacy: "public",
      players: [player._id],
      followers: [follower._id],
    });

    const res = await request(app)
      .post(`/api/tables/${table._id}/images`)
      .set("Authorization", `Bearer ${token}`)
      .attach("image", fakeImageBuffer, {
        filename: "x.jpg",
        contentType: "image/jpeg",
      });
    expect(res.status).toBe(201);

    const notifs = await Notification.find({ type: "image" });
    const recipientIds = notifs.map((n) => n.recipient.toString()).sort();
    // Host es uploader → excluido; player + follower esperados.
    expect(recipientIds).toEqual(
      [player._id.toString(), follower._id.toString()].sort(),
    );
  });

  it("mesa friends: notifica solo a players (followers legacy quedan inertes)", async () => {
    const player = await createUser();
    const follower = await createUser();
    const { user: host, token } = await createAuthedUser();
    const table = await createTable(host, {
      privacy: "friends",
      players: [player._id],
      followers: [follower._id],
    });

    const res = await request(app)
      .post(`/api/tables/${table._id}/images`)
      .set("Authorization", `Bearer ${token}`)
      .attach("image", fakeImageBuffer, {
        filename: "x.jpg",
        contentType: "image/jpeg",
      });
    expect(res.status).toBe(201);

    const notifs = await Notification.find({ type: "image" });
    const recipientIds = notifs.map((n) => n.recipient.toString());
    expect(recipientIds).toEqual([player._id.toString()]);
  });

  it("mesa privada: notifica solo a players (followers legacy quedan inertes)", async () => {
    const player = await createUser();
    const follower = await createUser();
    const { user: host, token } = await createAuthedUser();
    const table = await createTable(host, {
      privacy: "private",
      players: [player._id],
      followers: [follower._id],
    });

    const res = await request(app)
      .post(`/api/tables/${table._id}/images`)
      .set("Authorization", `Bearer ${token}`)
      .attach("image", fakeImageBuffer, {
        filename: "x.jpg",
        contentType: "image/jpeg",
      });
    expect(res.status).toBe(201);

    const notifs = await Notification.find({ type: "image" });
    const recipientIds = notifs.map((n) => n.recipient.toString());
    expect(recipientIds).toEqual([player._id.toString()]);
  });
});

describe("POST /api/tables/:id/messages — chat notificación en friends/private", () => {
  it("mesa friends: el chat sigue funcional, notifica al otro player (membership-based)", async () => {
    const otherPlayer = await createUser();
    const { user: host, token } = await createAuthedUser();
    const table = await createTable(host, {
      privacy: "friends",
      players: [otherPlayer._id],
    });

    const res = await request(app)
      .post(`/api/tables/${table._id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "Hola amigos" });
    expect(res.status).toBe(201);

    const notifs = await Notification.find({ type: "chat" });
    const recipientIds = notifs.map((n) => n.recipient.toString());
    expect(recipientIds).toEqual([otherPlayer._id.toString()]);
  });

  it("mesa privada: chat sigue funcional, notifica al otro player", async () => {
    const otherPlayer = await createUser();
    const { user: host, token } = await createAuthedUser();
    const table = await createTable(host, {
      privacy: "private",
      players: [otherPlayer._id],
    });

    const res = await request(app)
      .post(`/api/tables/${table._id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "Hola amigos" });
    expect(res.status).toBe(201);

    const notifs = await Notification.find({ type: "chat" });
    const recipientIds = notifs.map((n) => n.recipient.toString());
    expect(recipientIds).toEqual([otherPlayer._id.toString()]);
  });
});
