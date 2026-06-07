const {
  locationKeyFor,
  nameFromKey,
  sanitizeLocationKeys,
  applyOverlayToLocations,
  overlayToLocationRow,
} = require("../../../../services/bgg/bggLocationOverlay");

describe("bggLocationOverlay (pure helpers)", () => {
  describe("locationKeyFor", () => {
    it("trims + lowercases into l:<name>", () => {
      expect(locationKeyFor("  Casa De Juan ")).toBe("l:casa de juan");
      expect(locationKeyFor("CLUB")).toBe("l:club");
    });
    it("returns empty string for blank input", () => {
      expect(locationKeyFor("")).toBe("");
      expect(locationKeyFor("   ")).toBe("");
      expect(locationKeyFor(null)).toBe("");
    });
  });

  describe("nameFromKey", () => {
    it("strips the l: prefix", () => {
      expect(nameFromKey("l:casa")).toBe("casa");
      expect(nameFromKey("u:bob")).toBe("");
      expect(nameFromKey("")).toBe("");
    });
  });

  describe("sanitizeLocationKeys", () => {
    it("keeps only well-formed l: keys, lowercased + deduped", () => {
      expect(
        sanitizeLocationKeys([
          "l:Casa",
          "l:casa",
          "u:bob",
          "n:x",
          "garbage",
          5,
        ]),
      ).toEqual(["l:casa"]);
    });
    it("returns [] for non-arrays", () => {
      expect(sanitizeLocationKeys(null)).toEqual([]);
      expect(sanitizeLocationKeys("l:casa")).toEqual([]);
    });
  });

  describe("applyOverlayToLocations", () => {
    const roster = [
      {
        key: "l:casa",
        name: "Casa",
        numPlays: 5,
        lastPlayedDate: "2026-03-01",
      },
      {
        key: "l:club",
        name: "Club",
        numPlays: 2,
        lastPlayedDate: "2026-01-01",
      },
    ];

    it("passes through unclaimed locations with a k: key", () => {
      const out = applyOverlayToLocations(roster, { byKey: new Map() });
      const casa = out.find((r) => r.name === "Casa");
      expect(casa).toMatchObject({
        key: "k:l:casa",
        overlayId: null,
        rawKeys: ["l:casa"],
        numPlays: 5,
        lastPlayedDate: "2026-03-01",
      });
    });

    it("folds rows claimed by the same overlay and applies nameOverride", () => {
      const overlay = {
        _id: "o1",
        rawKeys: ["l:casa", "l:club"],
        nameOverride: "Mi Casa",
      };
      const byKey = new Map([
        ["l:casa", overlay],
        ["l:club", overlay],
      ]);
      const out = applyOverlayToLocations(roster, { byKey });
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({
        key: "o:o1",
        overlayId: "o1",
        name: "Mi Casa",
        numPlays: 7, // 5 + 2
        lastPlayedDate: "2026-03-01", // max
      });
      expect(out[0].rawKeys).toEqual(["l:casa", "l:club"]);
    });

    it("uses the most-recent spelling when there is no override", () => {
      const overlay = { _id: "o2", rawKeys: ["l:casa", "l:club"] };
      const byKey = new Map([
        ["l:casa", overlay],
        ["l:club", overlay],
      ]);
      // Club is more recent here → its spelling wins as the representative name.
      const recentClub = [
        {
          key: "l:casa",
          name: "Casa",
          numPlays: 1,
          lastPlayedDate: "2026-01-01",
        },
        {
          key: "l:club",
          name: "Club",
          numPlays: 1,
          lastPlayedDate: "2026-05-01",
        },
      ];
      const out = applyOverlayToLocations(recentClub, { byKey });
      expect(out[0].name).toBe("Club");
    });
  });

  describe("overlayToLocationRow", () => {
    it("derives the name from nameOverride, else the first raw key", () => {
      expect(
        overlayToLocationRow({
          _id: "o1",
          rawKeys: ["l:casa"],
          nameOverride: "Mi Casa",
        }),
      ).toMatchObject({ key: "o:o1", name: "Mi Casa", rawKeys: ["l:casa"] });

      expect(
        overlayToLocationRow({
          _id: "o2",
          rawKeys: ["l:club"],
          nameOverride: null,
        }),
      ).toMatchObject({ name: "club" });
    });
  });
});
