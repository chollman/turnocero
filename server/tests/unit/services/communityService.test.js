const communityService = require("../../../services/communityService");
const Community = require("../../../models/Community");
const User = require("../../../models/User");
const { createUser } = require("../../helpers/auth");

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
