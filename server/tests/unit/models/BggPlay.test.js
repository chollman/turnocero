const mongoose = require("mongoose");
const BggPlay = require("../../../models/BggPlay");

describe("BggPlay model", () => {
  it("persists a play with its players array", async () => {
    const doc = await BggPlay.create({
      bggUsername: "TestUser",
      playId: "1001",
      date: "2026-05-01",
      gameId: "13",
      gameName: "Catan",
      duration: 60,
      players: [
        { name: "Alice", score: "8", win: true },
        { name: "Bob", score: "5" },
      ],
    });
    expect(doc.bggUsername).toBe("testuser"); // lowercased
    expect(doc.playId).toBe("1001");
    expect(doc.players).toHaveLength(2);
    expect(doc.players[0].win).toBe(true);
    expect(doc.players[1].win).toBe(false);
  });

  it("enforces uniqueness on (bggUsername, playId)", async () => {
    await BggPlay.create({ bggUsername: "dup", playId: "1" });
    await BggPlay.init();
    let err;
    try {
      await BggPlay.create({ bggUsername: "dup", playId: "1" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe(11000);
  });

  it("allows the same playId for different usernames", async () => {
    await BggPlay.create({ bggUsername: "userA", playId: "5" });
    const d = await BggPlay.create({ bggUsername: "userB", playId: "5" });
    expect(d).toBeTruthy();
  });

  it("requires bggUsername and playId", async () => {
    let err;
    try {
      await BggPlay.create({ playId: "1" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);

    err = undefined;
    try {
      await BggPlay.create({ bggUsername: "x" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
  });
});
