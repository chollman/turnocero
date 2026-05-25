const mongoose = require("mongoose");
const BggCollection = require("../../../models/BggCollection");

describe("BggCollection model", () => {
  it("persists username (lowercased) + games array", async () => {
    const doc = await BggCollection.create({
      bggUsername: "TestUser",
      games: [
        { id: "1", name: "A", thumbnail: "t1", numPlays: 5 },
        { id: "2", name: "B", thumbnail: null, numPlays: 0 },
      ],
    });
    expect(doc.bggUsername).toBe("testuser"); // lowercased on save
    expect(doc.games).toHaveLength(2);
    expect(doc.games[0].name).toBe("A");
    expect(doc.games[1].thumbnail).toBeNull();
    expect(doc.lastFetchedAt).toBeInstanceOf(Date);
  });

  it("defaults lastFetchedAt to now when not provided", async () => {
    const before = Date.now();
    const doc = await BggCollection.create({ bggUsername: "x", games: [] });
    const after = Date.now();
    expect(doc.lastFetchedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(doc.lastFetchedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("enforces uniqueness on bggUsername", async () => {
    await BggCollection.create({ bggUsername: "dup", games: [] });
    await BggCollection.init();
    let err;
    try {
      await BggCollection.create({ bggUsername: "dup", games: [] });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe(11000);
  });

  it("requires bggUsername", async () => {
    let err;
    try {
      await BggCollection.create({ games: [] });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
  });
});
