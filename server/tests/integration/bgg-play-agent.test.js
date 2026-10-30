const request = require("supertest");
const app = require("../../app");
const AgentConversation = require("../../models/AgentConversation");
const AgentUsage = require("../../models/AgentUsage");
const BggGame = require("../../models/BggGame");
const { createAuthedUser, authHeader } = require("../helpers/auth");
const { loadSiteConfig, updateSiteConfig } = require("../../utils/siteConfig");
const {
  __setClientForTests,
  DAILY_CONVERSATIONS,
  MAX_USER_TURNS,
} = require("../../services/bgg/playAgent/playAgentService");

// POST /api/bgg/agente — agente de carga de partidas. El modelo se reemplaza
// por un cliente falso: ningún test llama a la API de Anthropic.

const usage = { input_tokens: 2000, output_tokens: 150, cache_read_input_tokens: 1500 };

function scriptedClient(responses) {
  return {
    messages: {
      create: vi.fn(async () => {
        const next = responses.shift();
        if (!next) return { stop_reason: "end_turn", usage, content: [{ type: "text", text: "ok" }] };
        if (next instanceof Error) throw next;
        return next;
      }),
    },
  };
}

const replyOnly = (text) => ({ stop_reason: "end_turn", usage, content: [{ type: "text", text }] });

// Usuario habilitado para el agente desde /panel-admin (feature en piloto).
const createAgentUser = (overrides = {}) =>
  createAuthedUser({ betaFeatures: ["bgwatchAgent"], ...overrides });

async function enableAgent() {
  await updateSiteConfig({ bgwatchAgent: { enabled: true } }, null);
}

beforeEach(async () => {
  await loadSiteConfig();
  global.fetch = vi.fn(async () => {
    throw new Error("network disabled in tests");
  });
});

afterEach(() => {
  __setClientForTests(null);
  delete global.fetch;
});

describe("POST /api/bgg/agente — gating", () => {
  it("is off for everyone but admins while the switch is off, even enabled users", async () => {
    const { token } = await createAgentUser({ bggUsername: "alice" });
    const res = await request(app).post("/api/bgg/agente").set(authHeader(token)).send({ message: "hola" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("feature_not_enabled");
    expect(res.body.feature).toBe("bgwatchAgent");
  });

  it("lets admins in while the switch is off", async () => {
    __setClientForTests(scriptedClient([replyOnly("¿Qué jugaste?")]));
    const { token } = await createAuthedUser({ bggUsername: "alice", isAdmin: true });
    const res = await request(app).post("/api/bgg/agente").set(authHeader(token)).send({ message: "hola" });
    expect(res.status).toBe(200);
  });

  it("with the switch on, rejects users an admin did not enable", async () => {
    await enableAgent();
    const { token } = await createAuthedUser({ bggUsername: "alice" });
    const res = await request(app).post("/api/bgg/agente").set(authHeader(token)).send({ message: "hola" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("feature_not_enabled");
  });

  it("with the switch on, lets enabled users in", async () => {
    await enableAgent();
    __setClientForTests(scriptedClient([replyOnly("¿Qué jugaste?")]));
    const { token } = await createAgentUser({ bggUsername: "alice" });
    const res = await request(app).post("/api/bgg/agente").set(authHeader(token)).send({ message: "hola" });
    expect(res.status).toBe(200);
  });

  it("requires authentication", async () => {
    await enableAgent();
    const res = await request(app).post("/api/bgg/agente").send({ message: "hola" });
    expect(res.status).toBe(401);
  });

  it("requires a BGG username", async () => {
    await enableAgent();
    __setClientForTests(scriptedClient([]));
    const { token } = await createAgentUser();
    const res = await request(app).post("/api/bgg/agente").set(authHeader(token)).send({ message: "hola" });
    expect(res.status).toBe(400);
  });

  it("answers 503 when no model client is configured", async () => {
    await enableAgent();
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const { token } = await createAgentUser({ bggUsername: "alice" });
    const res = await request(app).post("/api/bgg/agente").set(authHeader(token)).send({ message: "hola" });
    expect(res.status).toBe(503);
    if (prev) process.env.ANTHROPIC_API_KEY = prev;
  });
});

describe("POST /api/bgg/agente — conversation", () => {
  beforeEach(enableAgent);

  it("creates a draft through the tools and records token usage", async () => {
    await BggGame.create({ gameId: 13, name: "Catan", minPlayers: 3, maxPlayers: 4 });
    __setClientForTests(
      scriptedClient([
        {
          stop_reason: "tool_use",
          usage,
          content: [
            {
              type: "tool_use",
              id: "t1",
              name: "create_play_draft",
              input: {
                gameId: "13",
                gameName: "Catan",
                playdate: "2026-01-10",
                mode: "versus",
                players: [
                  { name: "Alice", username: "alice", score: 10, win: true },
                  { name: "Bob", score: 7 },
                  { name: "Carla", score: 8 },
                ],
              },
            },
          ],
        },
        replyOnly("Listo, revisá el borrador."),
      ]),
    );
    const { user, token } = await createAgentUser({ bggUsername: "alice" });

    const res = await request(app)
      .post("/api/bgg/agente")
      .set(authHeader(token))
      .send({ message: "Catan el 10 de enero con Bob y Carla, gané 10 a 8 a 7" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      reply: "Listo, revisá el borrador.",
      status: "draft_created",
      warnings: [],
      turnsLeft: MAX_USER_TURNS - 1,
    });
    expect(res.body.draft.game).toMatchObject({ id: "13", name: "Catan" });
    expect(res.body.draft.players).toHaveLength(3);

    const conv = await AgentConversation.findById(res.body.conversationId).lean();
    expect(String(conv.userId)).toBe(String(user._id));
    expect(conv.status).toBe("draft_created");
    expect(conv.messages[0].content).toContain("<context>");

    const rows = await AgentUsage.find({ conversationId: conv._id }).lean();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ inputTokens: 2000, outputTokens: 150, cacheReadTokens: 1500 });
    expect(rows[0].costUsd).toBeGreaterThan(0);
  });

  it("continues an existing conversation and rejects someone else's", async () => {
    __setClientForTests(scriptedClient([replyOnly("¿Qué juego?"), replyOnly("Dale.")]));
    const { token } = await createAgentUser({ bggUsername: "alice" });
    const first = await request(app).post("/api/bgg/agente").set(authHeader(token)).send({ message: "jugamos ayer" });
    const second = await request(app)
      .post("/api/bgg/agente")
      .set(authHeader(token))
      .send({ message: "Azul", conversationId: first.body.conversationId });
    expect(second.status).toBe(200);
    expect(second.body.conversationId).toBe(first.body.conversationId);
    expect(second.body.turnsLeft).toBe(MAX_USER_TURNS - 2);

    const other = await createAgentUser({ bggUsername: "bob" });
    const stolen = await request(app)
      .post("/api/bgg/agente")
      .set(authHeader(other.token))
      .send({ message: "x", conversationId: first.body.conversationId });
    expect(stolen.status).toBe(404);
  });

  it("returns a question with options and accepts the tapped option", async () => {
    const calls = [];
    const responses = [
      {
        stop_reason: "tool_use",
        usage,
        content: [
          {
            type: "tool_use",
            id: "q1",
            name: "ask_user",
            input: {
              question: "¿Cuál de los dos?",
              kind: "player",
              options: [
                { label: "Melina Gómez", value: "meli_g", detail: "@meli_g" },
                { label: "Melisa Ruiz", value: "Melisa Ruiz" },
              ],
            },
          },
        ],
      },
      replyOnly("Dale."),
    ];
    __setClientForTests({
      messages: {
        create: vi.fn(async (params) => {
          calls.push(JSON.parse(JSON.stringify(params.messages)));
          return responses.shift();
        }),
      },
    });
    const { token } = await createAgentUser({ bggUsername: "alice" });

    const first = await request(app).post("/api/bgg/agente").set(authHeader(token)).send({ message: "Azul con Meli" });
    expect(first.status).toBe(200);
    expect(first.body.reply).toBe("¿Cuál de los dos?");
    expect(first.body.question).toEqual({
      text: "¿Cuál de los dos?",
      kind: "player",
      options: [
        { label: "Melina Gómez", value: "meli_g", detail: "@meli_g" },
        { label: "Melisa Ruiz", value: "Melisa Ruiz", detail: "" },
      ],
    });
    const stored = await AgentConversation.findById(first.body.conversationId).lean();
    expect(stored.pendingAsk.toolUseId).toBe("q1");

    const second = await request(app)
      .post("/api/bgg/agente")
      .set(authHeader(token))
      .send({ message: "Melina Gómez", conversationId: first.body.conversationId, choice: "meli_g" });
    expect(second.status).toBe(200);
    expect(second.body.question).toBeNull();
    const lastUserTurn = calls[1].at(-1);
    expect(lastUserTurn.content[0]).toMatchObject({ type: "tool_result", tool_use_id: "q1" });
    expect(JSON.parse(lastUserTurn.content[0].content)).toEqual({ selected: { label: "Melina Gómez", value: "meli_g" } });
    const after = await AgentConversation.findById(first.body.conversationId).lean();
    expect(after.pendingAsk).toBeNull();
  });

  it("enforces the per-conversation message cap", async () => {
    __setClientForTests(scriptedClient([]));
    const { user, token } = await createAgentUser({ bggUsername: "alice" });
    const conv = await AgentConversation.create({ userId: user._id, agent: "playLogger", userTurns: MAX_USER_TURNS });
    const res = await request(app)
      .post("/api/bgg/agente")
      .set(authHeader(token))
      .send({ message: "x", conversationId: String(conv._id) });
    expect(res.status).toBe(429);
  });

  it("enforces the daily limit of new conversations", async () => {
    __setClientForTests(scriptedClient([]));
    const { user, token } = await createAgentUser({ bggUsername: "alice" });
    await AgentConversation.insertMany(
      Array.from({ length: DAILY_CONVERSATIONS }, () => ({ userId: user._id, agent: "playLogger" })),
    );
    const res = await request(app).post("/api/bgg/agente").set(authHeader(token)).send({ message: "x" });
    expect(res.status).toBe(429);
    expect(res.body.message).toContain(String(DAILY_CONVERSATIONS));
  });

  it("does not consume quota when the first message fails", async () => {
    __setClientForTests(scriptedClient([Object.assign(new Error("bad"), { status: 400 })]));
    const { user, token } = await createAgentUser({ bggUsername: "alice" });
    const res = await request(app).post("/api/bgg/agente").set(authHeader(token)).send({ message: "x" });
    expect(res.status).toBe(502);
    expect(await AgentConversation.countDocuments({ userId: user._id })).toBe(0);
  });

  it.each([
    [{ message: "" }, 400],
    [{ message: "a".repeat(1001) }, 400],
    [{ message: "hola", conversationId: "not-an-id" }, 400],
  ])("validates the body %#", async (body, status) => {
    __setClientForTests(scriptedClient([]));
    const { token } = await createAgentUser({ bggUsername: "alice" });
    const res = await request(app).post("/api/bgg/agente").set(authHeader(token)).send(body);
    expect(res.status).toBe(status);
  });
});
