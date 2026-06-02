const Community = require("../../models/Community");
const User = require("../../models/User");
const Table = require("../../models/Table");
const Compartida = require("../../models/Compartida");
const { seedBaseCommunity } = require("../../scripts/seed-base-community");
const { createUser } = require("../helpers/auth");
const { createTable, createCompartida } = require("../helpers/factories");

describe("seed-base-community", () => {
  it("creates the base community", async () => {
    const base = await seedBaseCommunity();
    expect(base.isBase).toBe(true);
    expect(base.slug).toBe("turnocero");
    expect(await Community.countDocuments({ isBase: true })).toBe(1);
  });

  it("backfills community on pre-existing content", async () => {
    const user = await createUser();
    const table = await createTable(user);
    const compartida = await createCompartida(user);
    // Simular contenido pre-migración: docs sin el campo `community` (las
    // factories ya lo setean, así que lo quitamos a mano vía la colección raw).
    await Table.collection.updateOne(
      { _id: table._id },
      { $unset: { community: "" } },
    );
    await Compartida.collection.updateOne(
      { _id: compartida._id },
      { $unset: { community: "" } },
    );

    await seedBaseCommunity();
    const base = await Community.getBase();

    const t = await Table.findById(table._id);
    const c = await Compartida.findById(compartida._id);
    expect(t.community.toString()).toBe(base._id.toString());
    expect(c.community.toString()).toBe(base._id.toString());
  });

  it("adds the base membership + skin to pre-existing users (viewing stays empty)", async () => {
    const user = await createUser();
    await seedBaseCommunity();
    const base = await Community.getBase();

    const u = await User.findById(user._id);
    expect(u.communityMemberships).toHaveLength(1);
    expect(u.communityMemberships[0].community.toString()).toBe(
      base._id.toString(),
    );
    expect(u.communityMemberships[0].role).toBe("member");
    expect(u.communityPrefs.skin.toString()).toBe(base._id.toString());
    expect(u.communityPrefs.viewing).toEqual([]);
  });

  it("is idempotent — a second run duplicates nothing", async () => {
    const user = await createUser();
    await createTable(user);

    await seedBaseCommunity();
    await seedBaseCommunity();

    expect(await Community.countDocuments({ isBase: true })).toBe(1);
    const u = await User.findById(user._id);
    expect(u.communityMemberships).toHaveLength(1); // not pushed twice
  });
});
