const { runOnce } = require("../../../jobs/instagramPublish");
const Compartida = require("../../../models/Compartida");
const User = require("../../../models/User");
const Notification = require("../../../models/Notification");
const { encrypt } = require("../../../utils/encryption");
const { createUser } = require("../../helpers/auth");
const { createCompartida } = require("../../helpers/factories");
const { loadSiteConfig, updateSiteConfig } = require("../../../utils/siteConfig");

// `instagram_post_success`/`instagram_post_failed` están gateadas por la
// sección `instagramCrosspost` (default OFF) — sin esto, saveNotification
// las descarta silenciosamente y los asserts sobre Notification fallan.
beforeEach(async () => {
  await loadSiteConfig();
  await updateSiteConfig({ instagramCrosspost: { enabled: true } }, null, null);
});

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

// Igual que en las Compartidas reales, las imágenes ya viven en Cloudinary
// con una URL pública — no hace falta mockear Cloudinary acá.
const ONE_IMAGE = [{ url: "https://cdn/img1.jpg", publicId: "p1" }];
const TWO_IMAGES = [
  { url: "https://cdn/img1.jpg", publicId: "p1" },
  { url: "https://cdn/img2.jpg", publicId: "p2" },
];

async function createConnectedUser(overrides = {}) {
  return createUser({
    instagramCredentials: {
      encryptedPageAccessToken: encrypt("real-page-token", "INSTAGRAM_CREDS_KEY"),
      igUserId: "ig-user-1",
      igUsername: "mesa.de.juegos",
      pageId: "page-1",
      pageName: "Mi Página",
      connectedAt: new Date(),
      invalid: false,
    },
    ...overrides,
  });
}

// Stub genérico: cualquier POST a .../media o .../media_publish devuelve un
// id incremental; cualquier GET de status devuelve FINISHED; el permalink
// fetch devuelve una URL fija. Suficiente para el happy path feed/story.
function stubHappyPathFetch() {
  let counter = 0;
  global.fetch = vi.fn(async (url, opts) => {
    const u = String(url);
    if (opts?.method === "POST" && u.includes("/media_publish")) {
      counter += 1;
      return jsonResponse({ id: `media-${counter}` });
    }
    if (opts?.method === "POST" && u.includes("/media")) {
      counter += 1;
      return jsonResponse({ id: `container-${counter}` });
    }
    if (u.includes("permalink")) {
      return jsonResponse({ permalink: "https://instagram.com/p/abc123" });
    }
    // Poll de status_code de un contenedor.
    return jsonResponse({ status_code: "FINISHED" });
  });
}

afterEach(() => {
  delete global.fetch;
});

describe("instagramPublish.runOnce — Feed", () => {
  it("publishes a single-image feed post and marks it posted", async () => {
    stubHappyPathFetch();
    const author = await createConnectedUser();
    const compartida = await createCompartida(author, { images: ONE_IMAGE });
    compartida.instagram.feed.status = "pending";
    await compartida.save();

    const result = await runOnce({ now: new Date(), io: global.__ioStub });

    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
    const stored = await Compartida.findById(compartida._id);
    expect(stored.instagram.feed.status).toBe("posted");
    expect(stored.instagram.feed.mediaId).toBeTruthy();
    expect(stored.instagram.feed.permalink).toBe(
      "https://instagram.com/p/abc123",
    );

    const notif = await Notification.findOne({
      recipient: author._id,
      type: "instagram_post_success",
      instagramTarget: "feed",
    });
    expect(notif).toBeTruthy();
    expect(notif.compartidaId).toBe(compartida._id.toString());

    expect(
      global.__ioStub.emitted.some((e) => e.event === "instagram:post-success"),
    ).toBe(true);
  });

  it("builds a carousel container for a multi-image feed post", async () => {
    stubHappyPathFetch();
    const author = await createConnectedUser();
    const compartida = await createCompartida(author, { images: TWO_IMAGES });
    compartida.instagram.feed.status = "pending";
    await compartida.save();

    await runOnce({ now: new Date() });

    // 2 children containers + 1 carousel container + 1 publish + 1 poll +
    // 1 permalink = al menos 2 llamadas con media_type CAROUSEL/is_carousel_item.
    const bodies = global.fetch.mock.calls
      .filter(([, opts]) => opts?.method === "POST")
      .map(([, opts]) => new URLSearchParams(opts.body));
    const carouselCalls = bodies.filter((p) => p.get("media_type") === "CAROUSEL");
    const childCalls = bodies.filter((p) => p.get("is_carousel_item") === "true");
    expect(carouselCalls).toHaveLength(1);
    expect(childCalls).toHaveLength(2);

    const stored = await Compartida.findById(compartida._id);
    expect(stored.instagram.feed.status).toBe("posted");
  });
});

describe("instagramPublish.runOnce — Story", () => {
  it("publishes only the first image and doesn't set a permalink", async () => {
    stubHappyPathFetch();
    const author = await createConnectedUser();
    const compartida = await createCompartida(author, { images: TWO_IMAGES });
    compartida.instagram.story.status = "pending";
    await compartida.save();

    await runOnce({ now: new Date() });

    const storyCalls = global.fetch.mock.calls.filter(
      ([, opts]) =>
        opts?.method === "POST" &&
        new URLSearchParams(opts.body).get("media_type") === "STORIES",
    );
    expect(storyCalls).toHaveLength(1);
    expect(new URLSearchParams(storyCalls[0][1].body).get("image_url")).toBe(
      TWO_IMAGES[0].url,
    );

    const stored = await Compartida.findById(compartida._id);
    expect(stored.instagram.story.status).toBe("posted");
    expect(stored.instagram.story.permalink).toBeUndefined();
  });
});

describe("instagramPublish.runOnce — both targets on the same Compartida", () => {
  it("processes feed and story independently and emits two notifications", async () => {
    stubHappyPathFetch();
    const author = await createConnectedUser();
    const compartida = await createCompartida(author, { images: ONE_IMAGE });
    compartida.instagram.feed.status = "pending";
    compartida.instagram.story.status = "pending";
    await compartida.save();

    const result = await runOnce({ now: new Date() });
    expect(result).toEqual({ processed: 2, succeeded: 2, failed: 0 });

    const stored = await Compartida.findById(compartida._id);
    expect(stored.instagram.feed.status).toBe("posted");
    expect(stored.instagram.story.status).toBe("posted");

    const notifs = await Notification.find({
      recipient: author._id,
      type: "instagram_post_success",
    });
    expect(notifs).toHaveLength(2);
    expect(notifs.map((n) => n.instagramTarget).sort()).toEqual([
      "feed",
      "story",
    ]);
  });
});

describe("instagramPublish.runOnce — failures", () => {
  it("marks the target failed and notifies when the Graph API errors", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ error: { message: "Something went wrong" } }, false, 500),
    );
    const author = await createConnectedUser();
    const compartida = await createCompartida(author, { images: ONE_IMAGE });
    compartida.instagram.feed.status = "pending";
    await compartida.save();

    const result = await runOnce({ now: new Date() });
    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 });

    const stored = await Compartida.findById(compartida._id);
    expect(stored.instagram.feed.status).toBe("failed");
    expect(stored.instagram.feed.error).toMatch(/Something went wrong/);

    const notif = await Notification.findOne({
      recipient: author._id,
      type: "instagram_post_failed",
    });
    expect(notif.instagramError).toMatch(/Something went wrong/);
  });

  it("marks the account invalid on an OAuthException (revoked/expired token)", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse(
        {
          error: {
            message: "Error validating access token",
            type: "OAuthException",
            code: 190,
          },
        },
        false,
        400,
      ),
    );
    const author = await createConnectedUser();
    const compartida = await createCompartida(author, { images: ONE_IMAGE });
    compartida.instagram.feed.status = "pending";
    await compartida.save();

    await runOnce({ now: new Date() });

    const refreshedAuthor = await User.findById(author._id);
    expect(refreshedAuthor.instagramCredentials.invalid).toBe(true);
  });

  it("fails gracefully (no throw) when the author disconnected Instagram after enqueueing", async () => {
    const author = await createUser();
    const compartida = await createCompartida(author, { images: ONE_IMAGE });
    compartida.instagram.feed.status = "pending";
    await compartida.save();

    const result = await runOnce({ now: new Date() });
    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 });

    const stored = await Compartida.findById(compartida._id);
    expect(stored.instagram.feed.status).toBe("failed");
  });
});

describe("instagramPublish.runOnce — nothing pending", () => {
  it("is a no-op when there's nothing to process", async () => {
    const result = await runOnce({ now: new Date() });
    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
  });

  it("ignores compartidas whose targets are already posted/failed/null", async () => {
    stubHappyPathFetch();
    const author = await createConnectedUser();
    const already = await createCompartida(author, { images: ONE_IMAGE });
    already.instagram.feed.status = "posted";
    await already.save();

    const result = await runOnce({ now: new Date() });
    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
  });
});
