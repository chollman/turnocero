const request = require("supertest");
const app = require("../../app");
const User = require("../../models/User");
const { createUser, createAuthedUser, tokenFor } = require("../helpers/auth");
const { loadSiteConfig, updateSiteConfig } = require("../../utils/siteConfig");
const SiteConfig = require("../../models/SiteConfig");

async function enableAllSections() {
  const all = {};
  for (const key of SiteConfig.SECTION_KEYS) all[key] = { enabled: true };
  await loadSiteConfig();
  await updateSiteConfig(all, null, null);
}

beforeEach(enableAllSections);

describe("POST /api/friends/:id/request", () => {
  it("sends a request: target gets a pending request entry", async () => {
    const target = await createUser({ username: "targetfriend" });
    const { user: me, token } = await createAuthedUser();

    const res = await request(app)
      .post(`/api/friends/${target._id}/request`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const updated = await User.findById(target._id);
    expect(
      updated.friendRequests.find((r) => r.from.equals(me._id)),
    ).toBeDefined();
  });

  it("400s when sending to self", async () => {
    const { user, token } = await createAuthedUser();
    const res = await request(app)
      .post(`/api/friends/${user._id}/request`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("400s when already friends", async () => {
    const target = await createUser();
    const { user, token } = await createAuthedUser({ friends: [target._id] });
    await User.updateOne({ _id: target._id }, { $push: { friends: user._id } });
    const res = await request(app)
      .post(`/api/friends/${target._id}/request`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("400s when a duplicate request is sent", async () => {
    const target = await createUser();
    const { token } = await createAuthedUser();
    await request(app)
      .post(`/api/friends/${target._id}/request`)
      .set("Authorization", `Bearer ${token}`);
    const res = await request(app)
      .post(`/api/friends/${target._id}/request`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/friends/:id/accept", () => {
  it("makes both users friends and clears the request", async () => {
    const sender = await createUser();
    const me = await createUser();
    me.friendRequests.push({ from: sender._id });
    await me.save();

    const res = await request(app)
      .post(`/api/friends/${sender._id}/accept`)
      .set("Authorization", `Bearer ${tokenFor(me)}`);
    expect(res.status).toBe(200);

    const meAfter = await User.findById(me._id);
    const senderAfter = await User.findById(sender._id);
    expect(meAfter.friends.map((f) => f.toString())).toContain(
      sender._id.toString(),
    );
    expect(senderAfter.friends.map((f) => f.toString())).toContain(
      me._id.toString(),
    );
    expect(
      meAfter.friendRequests.find((r) => r.from.equals(sender._id)),
    ).toBeUndefined();
  });

  it("400s when there is no pending request", async () => {
    const someone = await createUser();
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post(`/api/friends/${someone._id}/accept`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/friends/:id (unfriend)", () => {
  it("removes the bidirectional friendship", async () => {
    const other = await createUser();
    const me = await createUser({ friends: [other._id] });
    await User.updateOne({ _id: other._id }, { $push: { friends: me._id } });

    const res = await request(app)
      .delete(`/api/friends/${other._id}`)
      .set("Authorization", `Bearer ${tokenFor(me)}`);
    expect(res.status).toBe(200);

    const meAfter = await User.findById(me._id);
    const otherAfter = await User.findById(other._id);
    expect(meAfter.friends.map((f) => f.toString())).not.toContain(
      other._id.toString(),
    );
    expect(otherAfter.friends.map((f) => f.toString())).not.toContain(
      me._id.toString(),
    );
  });
});

describe("section gating", () => {
  it('blocks every friends endpoint when "amigos" is disabled (non-admin)', async () => {
    await updateSiteConfig({ amigos: { enabled: false } }, null, null);
    const target = await createUser();
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post(`/api/friends/${target._id}/request`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
