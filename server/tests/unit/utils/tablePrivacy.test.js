const mongoose = require("mongoose");
const {
  canViewTable,
  buildPrivacyFilter,
  assertCanComment,
  assertCanRate,
  assertCanFollow,
  assertLinkable,
} = require("../../../utils/tablePrivacy");

function id() {
  return new mongoose.Types.ObjectId();
}

describe("canViewTable", () => {
  const hostId = id();
  const playerId = id();
  const friendId = id();
  const strangerId = id();

  const baseTable = {
    host: hostId,
    players: [playerId],
  };

  describe("public", () => {
    const t = { ...baseTable, privacy: "public" };

    it("anónimos la ven", () => {
      expect(canViewTable(t, null, [])).toBe(true);
    });
    it("cualquier user la ve", () => {
      expect(canViewTable(t, { _id: strangerId }, [])).toBe(true);
    });
  });

  describe("private", () => {
    const t = { ...baseTable, privacy: "private" };

    it("anónimos NO la ven", () => {
      expect(canViewTable(t, null, [])).toBe(false);
    });
    it("cualquier user autenticado la ve", () => {
      expect(canViewTable(t, { _id: strangerId }, [])).toBe(true);
    });
  });

  describe("friends", () => {
    const t = { ...baseTable, privacy: "friends" };

    it("anónimos NO la ven", () => {
      expect(canViewTable(t, null, [])).toBe(false);
    });

    it("un no-amigo no la ve", () => {
      expect(canViewTable(t, { _id: strangerId }, [])).toBe(false);
    });

    it("un amigo del host la ve", () => {
      expect(canViewTable(t, { _id: friendId }, [String(hostId)])).toBe(true);
    });

    it("el host la ve aunque no esté en sus propios friends", () => {
      expect(canViewTable(t, { _id: hostId }, [])).toBe(true);
    });

    it("un player la ve aunque no sea amigo", () => {
      expect(canViewTable(t, { _id: playerId }, [])).toBe(true);
    });
  });

  it("devuelve false si table es null/undefined", () => {
    expect(canViewTable(null, { _id: hostId }, [])).toBe(false);
    expect(canViewTable(undefined, { _id: hostId }, [])).toBe(false);
  });
});

describe("buildPrivacyFilter", () => {
  it("anon: privacy=public", () => {
    expect(buildPrivacyFilter(null, [])).toEqual({ privacy: "public" });
  });

  it("auth: $or con public, private, friends host∈friendIds, host=me, players=me", () => {
    const userId = id();
    const f1 = id();
    const f2 = id();
    const filter = buildPrivacyFilter({ _id: userId }, [
      String(f1),
      String(f2),
    ]);
    expect(filter.$or).toBeDefined();
    expect(filter.$or).toHaveLength(4);
    // public + private en mismo branch
    expect(filter.$or[0]).toEqual({ privacy: { $in: ["public", "private"] } });
    // friends con $in de friendIds
    expect(filter.$or[1].privacy).toBe("friends");
    expect(filter.$or[1].host.$in).toHaveLength(2);
    expect(filter.$or[1].host.$in.map(String)).toEqual([
      String(f1),
      String(f2),
    ]);
    // host=me y players=me como escape hatches
    expect(filter.$or[2]).toEqual({ host: userId });
    expect(filter.$or[3]).toEqual({ players: userId });
  });

  it("auth sin amigos: el branch friends queda con $in vacío (matchea cero)", () => {
    const userId = id();
    const filter = buildPrivacyFilter({ _id: userId }, []);
    expect(filter.$or[1].host.$in).toHaveLength(0);
  });
});

describe("asserts de gating social", () => {
  it("assertCanComment 403 en privadas y amigos, pasa en públicas", () => {
    expect(() => assertCanComment({ privacy: "public" })).not.toThrow();
    expect(() => assertCanComment({ privacy: "private" })).toThrow(/pública/i);
    expect(() => assertCanComment({ privacy: "friends" })).toThrow(/pública/i);
  });

  it("assertCanRate 403 en privadas y amigos, pasa en públicas", () => {
    expect(() => assertCanRate({ privacy: "public" })).not.toThrow();
    expect(() => assertCanRate({ privacy: "private" })).toThrow();
    expect(() => assertCanRate({ privacy: "friends" })).toThrow();
  });

  it("assertCanFollow 400 en privadas y amigos, pasa en públicas", () => {
    expect(() => assertCanFollow({ privacy: "public" })).not.toThrow();
    let err;
    try {
      assertCanFollow({ privacy: "private" });
    } catch (e) {
      err = e;
    }
    expect(err.status).toBe(400);
    expect(() => assertCanFollow({ privacy: "friends" })).toThrow();
  });

  it("assertLinkable 403 en privadas y amigos, pasa en públicas", () => {
    expect(() => assertLinkable({ privacy: "public" })).not.toThrow();
    expect(() => assertLinkable({ privacy: "private" })).toThrow();
    expect(() => assertLinkable({ privacy: "friends" })).toThrow();
  });

  it("trata privacy ausente como 'public' (default)", () => {
    expect(() => assertCanComment({})).not.toThrow();
    expect(() => assertCanRate({})).not.toThrow();
    expect(() => assertCanFollow({})).not.toThrow();
    expect(() => assertLinkable({})).not.toThrow();
  });
});
