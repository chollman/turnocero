const {
  rawKeyFor,
  sanitizeRawKeys,
  applyOverlayToCoPlayers,
  applyOverlayToPlayers,
  overlayToRow,
  loadSelfKeys,
} = require("../../../../services/bgg/bggPlayerOverlay");
const BggPlayerOverlay = require("../../../../models/BggPlayerOverlay");

// Build a minimal index { byKey } from a list of overlay-like objects.
function indexOf(overlays) {
  const byKey = new Map();
  for (const o of overlays) {
    for (const k of o.rawKeys) byKey.set(k, o);
  }
  return { byKey, overlays };
}

describe("bggPlayerOverlay — pure helpers", () => {
  describe("rawKeyFor", () => {
    it("keys by username (lowercased) when present", () => {
      expect(rawKeyFor({ name: "Juan", username: "JuanBGG" })).toBe(
        "u:juanbgg",
      );
    });
    it("falls back to name (lowercased) without a username", () => {
      expect(rawKeyFor({ name: "  Juan  ", username: "" })).toBe("n:juan");
    });
  });

  describe("sanitizeRawKeys", () => {
    it("keeps well-formed keys, lowercases and dedupes", () => {
      expect(
        sanitizeRawKeys(["U:Juan", "n:pedro", "n:pedro", "garbage", 42, null]),
      ).toEqual(["u:juan", "n:pedro"]);
    });
    it("returns [] for non-arrays", () => {
      expect(sanitizeRawKeys("nope")).toEqual([]);
    });
  });

  describe("applyOverlayToCoPlayers", () => {
    it("passes unclaimed rows through as singletons", () => {
      const rows = [
        { name: "Juan", username: "", numPlays: 3, lastPlayedDate: "2026-01-01" },
      ];
      const out = applyOverlayToCoPlayers(rows, indexOf([]));
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({
        name: "Juan",
        username: "",
        numPlays: 3,
        rawKeys: ["n:juan"],
        overlayId: null,
      });
    });

    it("folds rows claimed by one overlay into a single curated row", () => {
      const overlay = {
        _id: "ov1",
        rawKeys: ["n:juan", "u:juanbgg"],
        nameOverride: "Juancito",
        bggUsername: "juanbgg",
        avatar: { url: "http://img/a.webp", publicId: "p" },
      };
      const rows = [
        { name: "Juan", username: "", numPlays: 2, lastPlayedDate: "2026-01-01" },
        {
          name: "Juan",
          username: "juanbgg",
          numPlays: 3,
          lastPlayedDate: "2026-03-01",
        },
      ];
      const out = applyOverlayToCoPlayers(rows, indexOf([overlay]));
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({
        name: "Juancito",
        username: "juanbgg",
        numPlays: 5,
        lastPlayedDate: "2026-03-01",
        overlayId: "ov1",
      });
      expect(out[0].avatar).toEqual({ url: "http://img/a.webp", publicId: "p" });
      expect(out[0].rawKeys).toEqual(["n:juan", "u:juanbgg"]);
    });

    it("excludeSelf drops rows flagged as the owner, but keeps them otherwise", () => {
      const overlay = { _id: "s1", rawKeys: ["n:yo"], isSelf: true };
      const rows = [
        { name: "Yo", username: "", numPlays: 4, lastPlayedDate: "2026-01-01" },
        { name: "Ana", username: "", numPlays: 1, lastPlayedDate: "2026-02-01" },
      ];
      const idx = indexOf([overlay]);
      // Sin excludeSelf, la fila "self" aparece con su flag.
      const all = applyOverlayToCoPlayers(rows, idx);
      const self = all.find((r) => r.name === "Yo");
      expect(self.isSelf).toBe(true);
      // Con excludeSelf, desaparece.
      const filtered = applyOverlayToCoPlayers(rows, idx, { excludeSelf: true });
      expect(filtered.some((r) => r.name === "Yo")).toBe(false);
      expect(filtered.some((r) => r.name === "Ana")).toBe(true);
    });
  });

  describe("applyOverlayToPlayers", () => {
    it("applies name/username/avatar overrides to matching players", () => {
      const overlay = {
        _id: "ov1",
        rawKeys: ["n:juan"],
        nameOverride: "Juancito",
        bggUsername: "juanbgg",
        avatar: { url: "http://img/a.webp", publicId: "p" },
      };
      const players = [
        { name: "Juan", username: "", score: "10" },
        { name: "Pedro", username: "", score: "5" },
      ];
      const out = applyOverlayToPlayers(players, indexOf([overlay]));
      expect(out[0]).toMatchObject({
        name: "Juancito",
        username: "juanbgg",
        score: "10",
      });
      expect(out[0].overlayAvatar).toEqual({
        url: "http://img/a.webp",
        publicId: "p",
      });
      // isSelf: el jugador se muestra como el dueño (username = ownerLower).
      const selfOverlay = { _id: "s1", rawKeys: ["n:yo"], isSelf: true };
      const selfOut = applyOverlayToPlayers(
        [{ name: "Yo", username: "" }],
        indexOf([selfOverlay]),
        { ownerLower: "alice" },
      );
      expect(selfOut[0].username).toBe("alice");

      // Unclaimed player untouched.
      expect(out[1]).toMatchObject({ name: "Pedro", username: "" });
      expect(out[1].overlayAvatar).toBeUndefined();
    });
  });

  describe("overlayToRow", () => {
    it("derives effective name/username and link flags", () => {
      const overlay = {
        _id: "ov1",
        rawKeys: ["n:juan", "u:juanbgg"],
        nameOverride: "Juancito",
        bggUsername: "juanbgg",
        avatar: { url: "", publicId: "" },
      };
      const row = overlayToRow(overlay, null);
      expect(row).toMatchObject({
        overlayId: "ov1",
        name: "Juancito",
        username: "juanbgg",
        isLinked: false,
        canEditNameAvatar: true,
        avatar: null,
      });
    });

    it("marks linked rows as not editable", () => {
      const overlay = { _id: "ov2", rawKeys: ["u:juanbgg"], avatar: {} };
      const row = overlayToRow(overlay, { _id: "u1", username: "juan" });
      expect(row.isLinked).toBe(true);
      expect(row.canEditNameAvatar).toBe(false);
      expect(row.linkedUser).toMatchObject({ _id: "u1" });
    });
  });
});

// DB-backed: loadSelfKeys resuelve qué claves de identidad cuentan como "el
// dueño" (base + las reclamadas por overlays isSelf). Lo consume computeGameStats.
describe("bggPlayerOverlay — loadSelfKeys (DB)", () => {
  it("sin overlays isSelf devuelve solo la clave base del dueño", async () => {
    expect(await loadSelfKeys("alice")).toEqual(["u:alice"]);
  });

  it("suma los rawKeys de cada overlay isSelf + la base; ignora los no-self", async () => {
    await BggPlayerOverlay.create({
      ownerUsername: "alice",
      rawKeys: ["n:juancho", "u:cuentavieja"],
      isSelf: true,
    });
    // Un overlay NO marcado isSelf no aporta claves.
    await BggPlayerOverlay.create({
      ownerUsername: "alice",
      rawKeys: ["n:bob"],
      isSelf: false,
    });
    const keys = await loadSelfKeys("alice");
    expect([...keys].sort()).toEqual(
      ["n:juancho", "u:alice", "u:cuentavieja"].sort(),
    );
  });

  it("no mezcla overlays isSelf de otro dueño", async () => {
    await BggPlayerOverlay.create({
      ownerUsername: "zoe",
      rawKeys: ["n:otro"],
      isSelf: true,
    });
    expect(await loadSelfKeys("alice")).toEqual(["u:alice"]);
  });
});
