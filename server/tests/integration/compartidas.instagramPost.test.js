const request = require("supertest");
const app = require("../../app");
const Compartida = require("../../models/Compartida");
const { createUser, createAuthedUser, tokenFor } = require("../helpers/auth");
const { createCompartida } = require("../helpers/factories");
const { loadSiteConfig, updateSiteConfig } = require("../../utils/siteConfig");
const SiteConfig = require("../../models/SiteConfig");

async function enableAllSections() {
  const all = {};
  for (const key of SiteConfig.SECTION_KEYS) all[key] = { enabled: true };
  await loadSiteConfig();
  await updateSiteConfig(all, null, null);
}

beforeEach(enableAllSections);

const CONNECTED_CREDS = {
  instagramCredentials: {
    encryptedPageAccessToken: "fake-encrypted-token",
    igUserId: "ig-user-1",
    igUsername: "mesa.de.juegos",
    pageId: "page-1",
    pageName: "Mi Página",
    connectedAt: new Date(),
    invalid: false,
  },
};

const withImage = { images: [{ url: "https://cdn/img.jpg", publicId: "x" }] };

describe("POST /api/compartidas/:id/instagram-post", () => {
  it("queues both feed and story as pending and responds 202 immediately", async () => {
    const author = await createUser(CONNECTED_CREDS);
    const compartida = await createCompartida(author, withImage);

    const res = await request(app)
      .post(`/api/compartidas/${compartida._id}/instagram-post`)
      .set("Authorization", `Bearer ${tokenFor(author)}`)
      .send({ feed: true, story: true });

    expect(res.status).toBe(202);
    expect(res.body.instagram.feed.status).toBe("pending");
    expect(res.body.instagram.story.status).toBe("pending");

    const stored = await Compartida.findById(compartida._id);
    expect(stored.instagram.feed.status).toBe("pending");
    expect(stored.instagram.story.status).toBe("pending");
  });

  it("queues only the requested target", async () => {
    const author = await createUser(CONNECTED_CREDS);
    const compartida = await createCompartida(author, withImage);

    const res = await request(app)
      .post(`/api/compartidas/${compartida._id}/instagram-post`)
      .set("Authorization", `Bearer ${tokenFor(author)}`)
      .send({ feed: true });

    expect(res.status).toBe(202);
    expect(res.body.instagram.feed.status).toBe("pending");
    expect(res.body.instagram.story.status).toBeNull();
  });

  it("400s when neither feed nor story is requested", async () => {
    const author = await createUser(CONNECTED_CREDS);
    const compartida = await createCompartida(author, withImage);

    const res = await request(app)
      .post(`/api/compartidas/${compartida._id}/instagram-post`)
      .set("Authorization", `Bearer ${tokenFor(author)}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("403s when the caller isn't the author", async () => {
    const author = await createUser(CONNECTED_CREDS);
    const other = await createAuthedUser();
    const compartida = await createCompartida(author, withImage);

    const res = await request(app)
      .post(`/api/compartidas/${compartida._id}/instagram-post`)
      .set("Authorization", `Bearer ${other.token}`)
      .send({ feed: true });

    expect(res.status).toBe(403);
  });

  it("400s when the compartida isn't public", async () => {
    const author = await createUser(CONNECTED_CREDS);
    const compartida = await createCompartida(author, {
      ...withImage,
      privacy: "friends",
    });

    const res = await request(app)
      .post(`/api/compartidas/${compartida._id}/instagram-post`)
      .set("Authorization", `Bearer ${tokenFor(author)}`)
      .send({ feed: true });

    expect(res.status).toBe(400);
  });

  it("400s when the compartida has no images", async () => {
    const author = await createUser(CONNECTED_CREDS);
    const compartida = await createCompartida(author, {});

    const res = await request(app)
      .post(`/api/compartidas/${compartida._id}/instagram-post`)
      .set("Authorization", `Bearer ${tokenFor(author)}`)
      .send({ feed: true });

    expect(res.status).toBe(400);
  });

  it("400s when the author hasn't connected Instagram", async () => {
    const author = await createUser();
    const compartida = await createCompartida(author, withImage);

    const res = await request(app)
      .post(`/api/compartidas/${compartida._id}/instagram-post`)
      .set("Authorization", `Bearer ${tokenFor(author)}`)
      .send({ feed: true });

    expect(res.status).toBe(400);
  });

  it("400s when the author's Instagram connection is marked invalid", async () => {
    const author = await createUser({
      instagramCredentials: {
        ...CONNECTED_CREDS.instagramCredentials,
        invalid: true,
      },
    });
    const compartida = await createCompartida(author, withImage);

    const res = await request(app)
      .post(`/api/compartidas/${compartida._id}/instagram-post`)
      .set("Authorization", `Bearer ${tokenFor(author)}`)
      .send({ feed: true });

    expect(res.status).toBe(400);
  });

  it("403s when the instagramCrosspost section is disabled (non-admin)", async () => {
    await updateSiteConfig(
      { instagramCrosspost: { enabled: false } },
      null,
      null,
    );
    const author = await createUser(CONNECTED_CREDS);
    const compartida = await createCompartida(author, withImage);

    const res = await request(app)
      .post(`/api/compartidas/${compartida._id}/instagram-post`)
      .set("Authorization", `Bearer ${tokenFor(author)}`)
      .send({ feed: true });

    expect(res.status).toBe(403);
  });

  it("401s without a valid session token", async () => {
    const author = await createUser(CONNECTED_CREDS);
    const compartida = await createCompartida(author, withImage);

    const res = await request(app)
      .post(`/api/compartidas/${compartida._id}/instagram-post`)
      .send({ feed: true });

    expect(res.status).toBe(401);
  });
});
