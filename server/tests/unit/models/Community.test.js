const mongoose = require("mongoose");
const Community = require("../../../models/Community");

describe("Community model — getBase / ensureBase", () => {
  it("ensureBase creates the base community (idempotent)", async () => {
    const a = await Community.ensureBase();
    const b = await Community.ensureBase();
    expect(a.isBase).toBe(true);
    expect(a.slug).toBe("turnocero");
    expect(a.name).toBe("TurnoCero");
    expect(b._id.toString()).toBe(a._id.toString());
    expect(await Community.countDocuments({ isBase: true })).toBe(1);
  });

  it("getBase lazily creates the base when it is missing", async () => {
    Community.__resetBaseCache();
    expect(await Community.countDocuments()).toBe(0);
    const base = await Community.getBase();
    expect(base.isBase).toBe(true);
    expect(await Community.countDocuments({ isBase: true })).toBe(1);
  });

  it("getBase returns the existing base without creating a second one", async () => {
    const created = await Community.ensureBase();
    Community.__resetBaseCache();
    const fetched = await Community.getBase();
    expect(fetched._id.toString()).toBe(created._id.toString());
    expect(await Community.countDocuments({ isBase: true })).toBe(1);
  });
});

describe("Community model — generateSlug", () => {
  it("slugifies a name (NFD-strips accents, lowercases)", async () => {
    expect(await Community.generateSlug("Club Ñandú")).toBe("club-nandu");
    expect(await Community.generateSlug("Rosario Juega")).toBe("rosario-juega");
  });

  it("appends a numeric suffix on collision", async () => {
    await Community.create({ name: "Rosario", slug: "rosario" });
    expect(await Community.generateSlug("Rosario")).toBe("rosario-1");
  });

  it("falls back to 'comunidad' for an empty/symbol-only name", async () => {
    expect(await Community.generateSlug("   ")).toBe("comunidad");
    expect(await Community.generateSlug("@#$%")).toBe("comunidad");
  });
});

describe("Community model — sanitizeSkinTokens", () => {
  it("keeps valid hex and rgb/rgba values", () => {
    const out = Community.sanitizeSkinTokens({
      amber: "#1888ef",
      red: "#fff",
      green: "rgba(0, 217, 132, 0.5)",
      orange: "rgb(245,166,35)",
    });
    expect(out).toEqual({
      amber: "#1888ef",
      red: "#fff",
      green: "rgba(0, 217, 132, 0.5)",
      orange: "rgb(245,166,35)",
    });
  });

  it("drops named colors and CSS-injection attempts (value allowlist)", () => {
    const out = Community.sanitizeSkinTokens({
      amber: "red", // named color → not in hex/rgb allowlist
      bgCard: "#000; color: red", // injection attempt
      bgDark: "url(https://evil/x.png)", // url() attempt
      ok: "#101010",
    });
    expect(out).toEqual({ ok: "#101010" });
  });

  it("drops keys with non-alphanumeric characters", () => {
    const out = Community.sanitizeSkinTokens({
      "bg-card": "#151c28", // hyphen → invalid key
      bgCard: "#151c28", // camelCase → valid
    });
    expect(out).toEqual({ bgCard: "#151c28" });
  });

  it("returns {} for non-object input", () => {
    expect(Community.sanitizeSkinTokens(null)).toEqual({});
    expect(Community.sanitizeSkinTokens("nope")).toEqual({});
  });
});

describe("Community model — toJSON / schema", () => {
  it("strips inviteCode and exposes hasCode (when the code is loaded)", async () => {
    const c = await Community.create({
      name: "Privada",
      slug: "privada",
      joinPolicy: "code",
      inviteCode: "SECRET123",
    });
    const json = c.toJSON();
    expect(json.inviteCode).toBeUndefined();
    expect(json.hasCode).toBe(true);
  });

  it("hasCode is false on a doc fetched without the select:false field", async () => {
    await Community.create({
      name: "Privada2",
      slug: "privada2",
      joinPolicy: "code",
      inviteCode: "SECRET123",
    });
    const fetched = await Community.findOne({ slug: "privada2" });
    const json = fetched.toJSON();
    expect(json.inviteCode).toBeUndefined();
    expect(json.hasCode).toBe(false);
  });

  it("defaults joinPolicy to 'open' and rejects an invalid policy", async () => {
    const c = await Community.create({ name: "Abierta", slug: "abierta" });
    expect(c.joinPolicy).toBe("open");
    await expect(
      Community.create({ name: "Bad", slug: "bad", joinPolicy: "secret" }),
    ).rejects.toThrow();
  });

  it("enforces the unique slug constraint", async () => {
    await Community.create({ name: "Uno", slug: "dup" });
    await expect(
      Community.create({ name: "Dos", slug: "dup" }),
    ).rejects.toThrow();
  });

  it("stores pendingMembers with user + requestedAt", async () => {
    const userId = new mongoose.Types.ObjectId();
    const c = await Community.create({
      name: "Aprobacion",
      slug: "aprobacion",
      joinPolicy: "approval",
      pendingMembers: [{ user: userId }],
    });
    expect(c.pendingMembers).toHaveLength(1);
    expect(c.pendingMembers[0].user.toString()).toBe(userId.toString());
    expect(c.pendingMembers[0].requestedAt).toBeInstanceOf(Date);
  });
});
