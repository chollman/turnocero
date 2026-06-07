const {
  invalidateOwnerDerived,
} = require("../../../../services/bgg/bggInvalidate");
const {
  setCached,
  getCached,
  _resetForTests,
} = require("../../../../services/bgg/bggCache");
const User = require("../../../../models/User");
const { createUser } = require("../../../helpers/auth");

describe("invalidateOwnerDerived", () => {
  beforeEach(() => {
    _resetForTests();
  });

  it("limpia el cache L1 de partidas del usuario (case-insensitive)", async () => {
    const key = "partidas:alice:bgg:1:-:-:-";
    setCached(key, { total: 1, plays: [] });
    expect(getCached(key)).not.toBeNull();
    // Acepta el bggUsername case-preserved y normaliza internamente.
    await invalidateOwnerDerived("Alice");
    expect(getCached(key)).toBeNull();
  });

  it("marca el cache 'Mis juegos' sucio (userGamesBuiltAt = null)", async () => {
    const user = await createUser({ bggUsername: "alice" });
    await User.updateOne(
      { _id: user._id },
      { $set: { "bggSync.userGamesBuiltAt": new Date() } },
    );
    await invalidateOwnerDerived("alice");
    const fresh = await User.findById(user._id).lean();
    expect(fresh.bggSync.userGamesBuiltAt).toBeNull();
  });

  it("es no-op (no tira) para un bggUsername vacío", async () => {
    await expect(invalidateOwnerDerived("")).resolves.toBeUndefined();
    await expect(invalidateOwnerDerived(null)).resolves.toBeUndefined();
  });
});
