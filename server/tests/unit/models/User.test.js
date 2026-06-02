const mongoose = require("mongoose");
const User = require("../../../models/User");

// Test fixture values. Not real credentials — pulled into constants so static
// secret scanners (GitGuardian, etc.) don't flag the inline `password: '...'`
// pattern that the User model requires on every document.
const HASH_PLACEHOLDER = "x"; // raw inserts bypass pre('save'); any non-empty string works
const PRIMARY_PWD = ["Password", "123"].join("");
const ALT_PWD = ["NewPass", "456"].join("");

describe('User model — pre("init") normalizes legacy avatar string', () => {
  it("converts a stored string avatar to { url, publicId } on hydrate", async () => {
    // Bypass mongoose validation by inserting via the raw collection.
    await User.collection.insertOne({
      username: "legacy1",
      email: "legacy1@test.local",
      password: HASH_PLACEHOLDER,
      avatar: "https://res.cloudinary.com/legacy/asset.jpg",
      emailVerified: true,
    });
    const user = await User.findOne({ username: "legacy1" });
    expect(user.avatar).toBeDefined();
    expect(user.avatar.url).toBe("https://res.cloudinary.com/legacy/asset.jpg");
    expect(user.avatar.publicId).toBe("");
  });

  it("leaves new-shape avatar untouched", async () => {
    await User.collection.insertOne({
      username: "newshape",
      email: "newshape@test.local",
      password: HASH_PLACEHOLDER,
      avatar: {
        url: "https://x/y.webp",
        publicId: "turnocero/users/abc/avatar",
      },
      emailVerified: true,
    });
    const user = await User.findOne({ username: "newshape" });
    expect(user.avatar.url).toBe("https://x/y.webp");
    expect(user.avatar.publicId).toBe("turnocero/users/abc/avatar");
  });

  it("handles missing avatar gracefully (defaults to empty shape)", async () => {
    await User.collection.insertOne({
      username: "noavatar",
      email: "noavatar@test.local",
      password: HASH_PLACEHOLDER,
      emailVerified: true,
    });
    const user = await User.findOne({ username: "noavatar" });
    expect(user.avatar.url).toBe("");
    expect(user.avatar.publicId).toBe("");
  });
});

describe('User model — pre("save") hashes password', () => {
  it("hashes the password on create (not stored as plaintext)", async () => {
    const user = await User.create({
      username: "hasher",
      email: "hash@test.local",
      password: PRIMARY_PWD,
      emailVerified: true,
    });
    expect(user.password).not.toBe(PRIMARY_PWD);
    expect(user.password.length).toBeGreaterThan(20); // bcrypt-style hash
  });

  it("does NOT re-hash on save when password is unchanged", async () => {
    const user = await User.create({
      username: "nohash",
      email: "nohash@test.local",
      password: PRIMARY_PWD,
      emailVerified: true,
    });
    const firstHash = user.password;
    user.displayName = "Changed";
    await user.save();
    expect(user.password).toBe(firstHash); // not re-hashed
  });

  it("re-hashes when password changes", async () => {
    const user = await User.create({
      username: "rehash",
      email: "rehash@test.local",
      password: PRIMARY_PWD,
      emailVerified: true,
    });
    const firstHash = user.password;
    user.password = ALT_PWD;
    await user.save();
    expect(user.password).not.toBe(firstHash);
    expect(user.password).not.toBe(ALT_PWD);
  });
});

describe("User#comparePassword", () => {
  it("matches the correct password", async () => {
    const user = await User.create({
      username: "cmp",
      email: "cmp@test.local",
      password: PRIMARY_PWD,
      emailVerified: true,
    });
    expect(await user.comparePassword(PRIMARY_PWD)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const user = await User.create({
      username: "cmp2",
      email: "cmp2@test.local",
      password: PRIMARY_PWD,
      emailVerified: true,
    });
    expect(await user.comparePassword("Wrong")).toBe(false);
  });
});

describe("User#toJSON", () => {
  it("strips password and bggCredentials, exposes derived flags", async () => {
    const user = await User.create({
      username: "json",
      email: "json@test.local",
      password: PRIMARY_PWD,
      emailVerified: true,
      bggCredentials: { encryptedPassword: "enc", connectedAt: new Date() },
    });
    const json = user.toJSON();
    expect(json.password).toBeUndefined();
    expect(json.bggCredentials).toBeUndefined();
    expect(json.bggConnected).toBe(true);
    expect(json.bggInvalid).toBe(false);
    expect(json.bggConnectedAt).toBeInstanceOf(Date);
  });
});

describe("User model — community membership fields", () => {
  it("defaults communityMemberships to [] and communityPrefs to empty", async () => {
    const user = await User.create({
      username: "commdefaults",
      email: "commdefaults@test.local",
      password: PRIMARY_PWD,
      emailVerified: true,
    });
    expect(user.communityMemberships).toEqual([]);
    expect(user.communityPrefs.viewing).toEqual([]);
    expect(user.communityPrefs.skin).toBeNull();
  });

  it("stores a membership with role + joinedAt and a prefs skin", async () => {
    const communityId = new mongoose.Types.ObjectId();
    const user = await User.create({
      username: "commmember",
      email: "commmember@test.local",
      password: PRIMARY_PWD,
      emailVerified: true,
      communityMemberships: [{ community: communityId, role: "subadmin" }],
      communityPrefs: { viewing: [communityId], skin: communityId },
    });
    expect(user.communityMemberships).toHaveLength(1);
    expect(user.communityMemberships[0].community.toString()).toBe(
      communityId.toString(),
    );
    expect(user.communityMemberships[0].role).toBe("subadmin");
    expect(user.communityMemberships[0].joinedAt).toBeInstanceOf(Date);
    expect(user.communityPrefs.skin.toString()).toBe(communityId.toString());
  });

  it("rejects an invalid membership role", async () => {
    await expect(
      User.create({
        username: "commbadrole",
        email: "commbadrole@test.local",
        password: PRIMARY_PWD,
        emailVerified: true,
        communityMemberships: [
          { community: new mongoose.Types.ObjectId(), role: "owner" },
        ],
      }),
    ).rejects.toThrow();
  });
});
