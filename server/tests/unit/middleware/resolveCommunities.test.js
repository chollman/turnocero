const mongoose = require("mongoose");
const {
  resolveCommunities,
  communityFilter,
} = require("../../../middleware/resolveCommunities");
const Community = require("../../../models/Community");

const run = (req) =>
  new Promise((resolve, reject) => {
    resolveCommunities(req, {}, (err) => (err ? reject(err) : resolve()));
  });

describe("resolveCommunities middleware", () => {
  it("anonymous → only the base community", async () => {
    const base = await Community.ensureBase();
    const req = {};
    await run(req);
    expect(req.viewingCommunities.map(String)).toEqual([String(base._id)]);
    expect(String(req.skinCommunity)).toBe(String(base._id));
  });

  it("member with no viewing pref → all memberships; skin falls back to base", async () => {
    const base = await Community.ensureBase();
    const a = new mongoose.Types.ObjectId();
    const b = new mongoose.Types.ObjectId();
    const req = {
      user: {
        communityMemberships: [{ community: a }, { community: b }],
        communityPrefs: { viewing: [], skin: null },
      },
    };
    await run(req);
    expect(req.viewingCommunities.map(String).sort()).toEqual(
      [String(a), String(b)].sort(),
    );
    expect(String(req.skinCommunity)).toBe(String(base._id));
  });

  it("honors a curated viewing subset and the chosen skin", async () => {
    await Community.ensureBase();
    const a = new mongoose.Types.ObjectId();
    const b = new mongoose.Types.ObjectId();
    const req = {
      user: {
        communityMemberships: [{ community: a }, { community: b }],
        communityPrefs: { viewing: [a], skin: a },
      },
    };
    await run(req);
    expect(req.viewingCommunities.map(String)).toEqual([String(a)]);
    expect(String(req.skinCommunity)).toBe(String(a));
  });

  it("drops viewing entries the user is no longer a member of (intersect with memberships)", async () => {
    await Community.ensureBase();
    const a = new mongoose.Types.ObjectId();
    const stale = new mongoose.Types.ObjectId();
    const req = {
      user: {
        communityMemberships: [{ community: a }],
        communityPrefs: { viewing: [a, stale], skin: null },
      },
    };
    await run(req);
    expect(req.viewingCommunities.map(String)).toEqual([String(a)]);
  });

  it("falls back to base when the user has no memberships (never empty)", async () => {
    const base = await Community.ensureBase();
    const req = {
      user: { communityMemberships: [], communityPrefs: { viewing: [] } },
    };
    await run(req);
    expect(req.viewingCommunities.map(String)).toEqual([String(base._id)]);
  });

  it("communityFilter builds an $in clause from req.viewingCommunities", () => {
    const a = new mongoose.Types.ObjectId();
    const filter = communityFilter({ viewingCommunities: [a] });
    expect(filter).toEqual({ community: { $in: [a] } });
  });
});
