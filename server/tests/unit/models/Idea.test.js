const mongoose = require("mongoose");
const Idea = require("../../../models/Idea");

describe("Idea model", () => {
  it("creates a doc with sensible defaults", async () => {
    const doc = await Idea.create({
      content: "Una idea suficientemente larga.",
    });
    expect(doc.status).toBe("new");
    expect(doc.fromUser).toBeNull();
    expect(doc.fromEmail).toBeNull();
    expect(doc.createdAt).toBeInstanceOf(Date);
  });

  it("trims and lowercases fromEmail", async () => {
    const doc = await Idea.create({
      content: "Otra idea muy razonable.",
      fromEmail: "  USER@Example.COM  ",
    });
    expect(doc.fromEmail).toBe("user@example.com");
  });

  it("requires content", async () => {
    let err;
    try {
      await Idea.create({});
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.content).toBeDefined();
  });

  it("rejects content under 10 chars", async () => {
    let err;
    try {
      await Idea.create({ content: "hola" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.content).toBeDefined();
  });

  it("rejects content over 2000 chars", async () => {
    let err;
    try {
      await Idea.create({ content: "x".repeat(2001) });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.content).toBeDefined();
  });

  it("rejects status outside the enum", async () => {
    let err;
    try {
      await Idea.create({
        content: "Una idea con status raro.",
        status: "raro",
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.status).toBeDefined();
  });

  it("exposes the STATUSES enum on the model", () => {
    expect(Idea.STATUSES).toEqual(["new", "reviewed", "archived"]);
  });
});
