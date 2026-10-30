const mongoose = require("mongoose");
const AgentUsage = require("../../../models/AgentUsage");
const AgentConversation = require("../../../models/AgentConversation");
const SiteConfig = require("../../../models/SiteConfig");

const userId = () => new mongoose.Types.ObjectId();

describe("AgentUsage model", () => {
  it("stores token counts with zero defaults", async () => {
    const doc = await AgentUsage.create({
      userId: userId(),
      agent: "playLogger",
      model: "claude-haiku-5-5",
      inputTokens: 1200,
    });
    expect(doc.inputTokens).toBe(1200);
    expect(doc.outputTokens).toBe(0);
    expect(doc.cacheReadTokens).toBe(0);
    expect(doc.costUsd).toBe(0);
    expect(doc.conversationId).toBeNull();
  });

  it("rejects an unknown agent kind", async () => {
    await expect(
      AgentUsage.create({ userId: userId(), agent: "otro", model: "x" }),
    ).rejects.toBeInstanceOf(mongoose.Error.ValidationError);
  });

  it("declares a TTL index on createdAt", () => {
    const ttl = AgentUsage.schema
      .indexes()
      .find(([fields, opts]) => fields.createdAt === 1 && opts.expireAfterSeconds);
    expect(ttl).toBeDefined();
  });
});

describe("AgentConversation model", () => {
  it("starts active with an empty history", async () => {
    const doc = await AgentConversation.create({
      userId: userId(),
      agent: "playLogger",
    });
    expect(doc.status).toBe("active");
    expect(doc.messages).toEqual([]);
    expect(doc.userTurns).toBe(0);
    expect(doc.draft).toBeNull();
  });

  it("persists Anthropic-shaped messages as-is", async () => {
    const messages = [
      { role: "user", content: "jugamos Azul" },
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "t1", name: "search_games", input: { query: "Azul" } }],
      },
    ];
    const doc = await AgentConversation.create({
      userId: userId(),
      agent: "playLogger",
      messages,
    });
    const fresh = await AgentConversation.findById(doc._id).lean();
    expect(fresh.messages).toEqual(messages);
  });

  it("declares a TTL index on updatedAt", () => {
    const ttl = AgentConversation.schema
      .indexes()
      .find(([fields, opts]) => fields.updatedAt === 1 && opts.expireAfterSeconds);
    expect(ttl).toBeDefined();
  });
});

describe("SiteConfig bgwatchAgent section", () => {
  it("is a known section key, disabled by default", () => {
    expect(SiteConfig.SECTION_KEYS).toContain("bgwatchAgent");
    expect(SiteConfig.defaultFor("bgwatchAgent")).toBe(false);
  });
});
