const shortlinkService = require("../../../services/shortlinkService");
const ShortLink = require("../../../models/ShortLink");
const { createUser } = require("../../helpers/auth");
const { createCompartida } = require("../../helpers/factories");

describe("shortlinkService.pathFor", () => {
  it("maps each type to its canonical path", () => {
    expect(shortlinkService.pathFor("compartida", "abc")).toBe(
      "/compartidas/abc",
    );
    expect(shortlinkService.pathFor("evento", "abc")).toBe("/eventos/abc");
    expect(shortlinkService.pathFor("noticia", "abc")).toBe("/noticias/abc");
    expect(shortlinkService.pathFor("bgwatch", "claudio")).toBe(
      "/bg-watch/claudio",
    );
    expect(shortlinkService.pathFor("partida", "claudio/1234")).toBe(
      "/bg-watch/claudio/partidas/1234",
    );
  });

  it("returns null for an unknown type", () => {
    expect(shortlinkService.pathFor("bogus", "abc")).toBeNull();
  });

  it("returns null for a malformed partida ref", () => {
    expect(shortlinkService.pathFor("partida", "claudio")).toBeNull();
  });
});

describe("shortlinkService.assertShareable (partida)", () => {
  it("accepts '<bggUsername>/<playId>' format", async () => {
    await expect(
      shortlinkService.assertShareable("partida", "claudio/1234"),
    ).resolves.toBeUndefined();
  });

  it("rejects refs without playId or with non-numeric playId", async () => {
    await expect(
      shortlinkService.assertShareable("partida", "claudio"),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      shortlinkService.assertShareable("partida", "claudio/abc"),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("ShortLink.generateCode", () => {
  it("returns a unique 7-char alphanumeric code", async () => {
    const code = await ShortLink.generateCode();
    expect(code).toMatch(/^[A-Za-z0-9]{7}$/);
  });
});

describe("shortlinkService.getOrCreate", () => {
  it("is idempotent per {type, ref}", async () => {
    const user = await createUser();
    const post = await createCompartida(user, { privacy: "public" });

    const first = await shortlinkService.getOrCreate({
      type: "compartida",
      ref: post._id.toString(),
      createdBy: user._id,
    });
    const second = await shortlinkService.getOrCreate({
      type: "compartida",
      ref: post._id.toString(),
    });

    expect(second.code).toBe(first.code);
    expect(await ShortLink.countDocuments()).toBe(1);
  });

  it("rejects an unshareable (private) compartida", async () => {
    const user = await createUser();
    const post = await createCompartida(user, { privacy: "private" });
    await expect(
      shortlinkService.getOrCreate({
        type: "compartida",
        ref: post._id.toString(),
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("shortlinkService.resolve", () => {
  it("returns the destination and counts the click", async () => {
    const user = await createUser();
    const post = await createCompartida(user, { privacy: "public" });
    const link = await shortlinkService.getOrCreate({
      type: "compartida",
      ref: post._id.toString(),
    });

    const resolved = await shortlinkService.resolve(link.code);
    expect(resolved).toEqual({
      type: "compartida",
      ref: post._id.toString(),
      path: `/compartidas/${post._id}`,
    });

    const doc = await ShortLink.findOne({ code: link.code });
    expect(doc.clicks).toBe(1);
  });

  it("returns null for an unknown code", async () => {
    expect(await shortlinkService.resolve("nope123")).toBeNull();
  });
});
