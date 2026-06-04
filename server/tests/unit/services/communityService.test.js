const communityService = require("../../../services/communityService");
const Community = require("../../../models/Community");
const User = require("../../../models/User");
const Table = require("../../../models/Table");
const { createUser } = require("../../helpers/auth");
const { createTable } = require("../../helpers/factories");

describe("communityService.memberCount", () => {
  it("counts only the members of the given community", async () => {
    const a = await Community.create({ name: "A", slug: "a" });
    const b = await Community.create({ name: "B", slug: "b" });
    await createUser({
      communityMemberships: [{ community: a._id, role: "member" }],
    });
    await createUser({
      communityMemberships: [{ community: a._id, role: "member" }],
    });
    await createUser({
      communityMemberships: [{ community: b._id, role: "member" }],
    });

    expect(await communityService.memberCount(a._id)).toBe(2);
    expect(await communityService.memberCount(b._id)).toBe(1);
  });
});

describe("communityService.memberIds", () => {
  it("returns the ids of the community's members only", async () => {
    const a = await Community.create({ name: "A", slug: "a" });
    const b = await Community.create({ name: "B", slug: "b" });
    const m1 = await createUser({
      communityMemberships: [{ community: a._id, role: "member" }],
    });
    const m2 = await createUser({
      communityMemberships: [{ community: a._id, role: "subadmin" }],
    });
    await createUser({
      communityMemberships: [{ community: b._id, role: "member" }],
    });

    const ids = (await communityService.memberIds(a._id)).map(String);
    expect(ids.sort()).toEqual([String(m1._id), String(m2._id)].sort());
  });

  it("excludes the given id (e.g. the author)", async () => {
    const a = await Community.create({ name: "A", slug: "a" });
    const author = await createUser({
      communityMemberships: [{ community: a._id, role: "member" }],
    });
    const other = await createUser({
      communityMemberships: [{ community: a._id, role: "member" }],
    });

    const ids = (
      await communityService.memberIds(a._id, { exclude: author._id })
    ).map(String);
    expect(ids).toEqual([String(other._id)]);
  });
});

describe("communityService.ensureTenantMembership", () => {
  it("adds membership ignoring joinPolicy (even 'approval')", async () => {
    const c = await Community.create({
      name: "Approval",
      slug: "approval",
      joinPolicy: "approval",
    });
    const user = await createUser();

    const added = await communityService.ensureTenantMembership(user, c);
    expect(added).toBe(true);
    expect(communityService.isMember(user, c._id)).toBe(true);

    // Persisted
    const reloaded = await User.findById(user._id);
    expect(communityService.isMember(reloaded, c._id)).toBe(true);
  });

  it("is idempotent (no-op + returns false if already a member)", async () => {
    const c = await Community.create({ name: "C", slug: "c" });
    const user = await createUser({
      communityMemberships: [{ community: c._id, role: "member" }],
    });
    const added = await communityService.ensureTenantMembership(user, c);
    expect(added).toBe(false);
    expect(
      user.communityMemberships.filter(
        (m) => String(m.community) === String(c._id),
      ),
    ).toHaveLength(1);
  });

  it("clears a pending join request when auto-joining", async () => {
    const user = await createUser();
    const c = await Community.create({
      name: "Pend",
      slug: "pend",
      joinPolicy: "approval",
      pendingMembers: [{ user: user._id }],
    });

    await communityService.ensureTenantMembership(user, c);
    const reloaded = await Community.findById(c._id);
    expect(reloaded.pendingMembers).toHaveLength(0);
    expect(communityService.isMember(user, c._id)).toBe(true);
  });

  it("no-ops when there is no tenant", async () => {
    const user = await createUser();
    expect(await communityService.ensureTenantMembership(user, null)).toBe(
      false,
    );
  });
});

describe("communityService.ensureBaseMembership", () => {
  it("adds base membership + skin and is idempotent", async () => {
    const user = await createUser();
    expect(user.communityMemberships).toEqual([]);

    const base = await communityService.ensureBaseMembership(user);
    expect(String(base._id)).toBe(String((await Community.getBase())._id));
    expect(user.communityMemberships).toHaveLength(1);
    expect(String(user.communityMemberships[0].community)).toBe(
      String(base._id),
    );
    expect(user.communityMemberships[0].role).toBe("member");
    expect(String(user.communityPrefs.skin)).toBe(String(base._id));

    // Idempotente: segunda llamada no duplica la membership.
    await communityService.ensureBaseMembership(user);
    const reloaded = await User.findById(user._id);
    expect(reloaded.communityMemberships).toHaveLength(1);
  });

  it("does not overwrite an existing skin preference", async () => {
    const user = await createUser();
    const other = await Community.create({ name: "Otra", slug: "otra" });
    user.communityPrefs.skin = other._id;
    await user.save();

    await communityService.ensureBaseMembership(user);
    // Skin queda en la elegida; igual se agrega la membership base.
    expect(String(user.communityPrefs.skin)).toBe(String(other._id));
    expect(
      communityService.isMember(user, (await Community.getBase())._id),
    ).toBe(true);
  });
});

describe("communityService.defaultCommunityFor", () => {
  it("returns the skin community when set, else base", async () => {
    const base = await Community.getBase();
    const user = await createUser();
    expect(String(await communityService.defaultCommunityFor(user))).toBe(
      String(base._id),
    );

    const b = await Community.create({ name: "Beta", slug: "beta" });
    user.communityPrefs.skin = b._id;
    expect(String(await communityService.defaultCommunityFor(user))).toBe(
      String(b._id),
    );
  });
});

describe("communityService.assertMembership / isMember", () => {
  it("throws 403 for a non-member and passes for a member", async () => {
    const user = await createUser();
    const b = await Community.create({ name: "Gamma", slug: "gamma" });

    expect(communityService.isMember(user, b._id)).toBe(false);
    expect(() => communityService.assertMembership(user, b._id)).toThrow(
      /No sos miembro/,
    );

    user.communityMemberships.push({ community: b._id, role: "member" });
    expect(communityService.isMember(user, b._id)).toBe(true);
    expect(() => communityService.assertMembership(user, b._id)).not.toThrow();
  });
});

describe("communityService.canModerate", () => {
  it("allows author, global admin, and a subadmin of the doc community", async () => {
    const c = await Community.create({ name: "CM", slug: "cm" });
    const author = await createUser();
    const doc = { author: author._id, community: c._id };
    expect(communityService.canModerate(author, doc)).toBe(true);
    expect(
      communityService.canModerate(
        { isAdmin: true, _id: author._id, communityMemberships: [] },
        doc,
      ),
    ).toBe(true);
    const sub = await createUser({
      communityMemberships: [{ community: c._id, role: "subadmin" }],
    });
    expect(communityService.canModerate(sub, doc)).toBe(true);
  });

  it("denies a non-author plain member", async () => {
    const c = await Community.create({ name: "CM2", slug: "cm2" });
    const author = await createUser();
    const stranger = await createUser({
      communityMemberships: [{ community: c._id, role: "member" }],
    });
    expect(
      communityService.canModerate(stranger, {
        author: author._id,
        community: c._id,
      }),
    ).toBe(false);
  });
});

describe("communityService.joinCommunity / leaveCommunity", () => {
  it("joinCommunity (open) adds membership and extends a curated viewing list", async () => {
    const a = await Community.create({
      name: "A",
      slug: "a",
      joinPolicy: "open",
    });
    const b = await Community.create({
      name: "B",
      slug: "b",
      joinPolicy: "open",
    });
    const user = await createUser({
      communityMemberships: [{ community: a._id, role: "member" }],
      communityPrefs: { viewing: [a._id], skin: a._id },
    });
    const result = await communityService.joinCommunity(user, b, {});
    expect(result.status).toBe("joined");
    expect(communityService.isMember(user, b._id)).toBe(true);
    // viewing-on-join: la comunidad nueva se suma al viewing curado.
    expect(user.communityPrefs.viewing.map(String)).toContain(String(b._id));
  });

  it("leaveCommunity prunes viewing and resets skin to base", async () => {
    const base = await Community.getBase();
    const b = await Community.create({
      name: "B2",
      slug: "b2",
      joinPolicy: "open",
    });
    const user = await createUser({
      communityMemberships: [{ community: b._id, role: "member" }],
      communityPrefs: { viewing: [b._id], skin: b._id },
    });
    await communityService.leaveCommunity(user, b);
    expect(communityService.isMember(user, b._id)).toBe(false);
    expect(user.communityPrefs.viewing).toHaveLength(0);
    expect(String(user.communityPrefs.skin)).toBe(String(base._id));
  });
});

describe("communityService.reassignContentToBase / deleteCommunity", () => {
  it("reassignContentToBase moves a community's content to base", async () => {
    const base = await Community.getBase();
    const b = await Community.create({
      name: "B3",
      slug: "b3",
      joinPolicy: "open",
    });
    const owner = await createUser();
    const table = await createTable(owner, { community: b._id });

    await communityService.reassignContentToBase(b);
    const moved = await Table.findById(table._id);
    expect(String(moved.community)).toBe(String(base._id));
  });

  it("deleteCommunity throws 409 while content remains", async () => {
    const b = await Community.create({
      name: "B4",
      slug: "b4",
      joinPolicy: "open",
    });
    const owner = await createUser();
    await createTable(owner, { community: b._id });
    await expect(communityService.deleteCommunity(b)).rejects.toMatchObject({
      status: 409,
    });
  });
});
