const communityService = require("../../../services/communityService");
const Community = require("../../../models/Community");
const User = require("../../../models/User");
const Table = require("../../../models/Table");
const { createUser } = require("../../helpers/auth");
const { createTable } = require("../../helpers/factories");

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
    expect(communityService.isMember(user, (await Community.getBase())._id)).toBe(
      true,
    );
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
    expect(() =>
      communityService.assertMembership(user, b._id),
    ).not.toThrow();
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
    const a = await Community.create({ name: "A", slug: "a", joinPolicy: "open" });
    const b = await Community.create({ name: "B", slug: "b", joinPolicy: "open" });
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
    const b = await Community.create({ name: "B2", slug: "b2", joinPolicy: "open" });
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
    const b = await Community.create({ name: "B3", slug: "b3", joinPolicy: "open" });
    const owner = await createUser();
    const table = await createTable(owner, { community: b._id });

    await communityService.reassignContentToBase(b);
    const moved = await Table.findById(table._id);
    expect(String(moved.community)).toBe(String(base._id));
  });

  it("deleteCommunity throws 409 while content remains", async () => {
    const b = await Community.create({ name: "B4", slug: "b4", joinPolicy: "open" });
    const owner = await createUser();
    await createTable(owner, { community: b._id });
    await expect(communityService.deleteCommunity(b)).rejects.toMatchObject({
      status: 409,
    });
  });
});
