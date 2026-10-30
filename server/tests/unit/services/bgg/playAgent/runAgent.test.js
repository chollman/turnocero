const { runPlayAgent, sanitizeQuestion, MAX_ITERATIONS, DEFAULT_MODEL, FALLBACK_MODEL } = require("../../../../../services/bgg/playAgent/runAgent");
const { costUsd } = require("../../../../../services/bgg/playAgent/pricing");

// Cliente falso: devuelve las respuestas encoladas en orden y registra cada llamada.
function fakeClient(responses) {
  const calls = [];
  return {
    calls,
    messages: {
      create: vi.fn(async (params) => {
        calls.push(JSON.parse(JSON.stringify(params)));
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return next;
      }),
    },
  };
}

const usage = { input_tokens: 1000, output_tokens: 100 };
const toolUse = (id, name, input) => ({ type: "tool_use", id, name, input });
const ctx = { bggUsername: "alice", ownerBggUsername: "alice", ownerName: "Alice", today: "2026-10-30", locale: "es" };

describe("runPlayAgent", () => {
  it("runs tools, keeps the draft and returns the final reply", async () => {
    const draft = { game: { id: "1" }, players: [] };
    const handlers = {
      search_games: vi.fn(async () => ({ results: [{ id: "1", name: "Azul" }] })),
      find_players: vi.fn(async () => ({ matches: [] })),
      create_play_draft: vi.fn(async () => ({ ok: true, errors: [], warnings: ["w"], draft })),
    };
    const client = fakeClient([
      { stop_reason: "tool_use", usage, content: [toolUse("a", "search_games", { query: "azul" }), toolUse("b", "find_players", { names: ["Juan"] })] },
      { stop_reason: "tool_use", usage, content: [toolUse("c", "create_play_draft", { gameId: "1" })] },
      { stop_reason: "end_turn", usage, content: [{ type: "text", text: "Listo, revisalo." }] },
    ]);
    const messages = [];
    const onUsage = vi.fn();

    const out = await runPlayAgent({ client, messages, userText: "ayer Azul con Juan", ctx, onUsage, handlers });

    expect(out).toEqual({
      reply: "Listo, revisalo.",
      draft,
      warnings: ["w"],
      status: "draft_created",
      question: null,
      pendingAsk: null,
    });
    expect(handlers.search_games).toHaveBeenCalledWith({ query: "azul" }, ctx);
    expect(onUsage).toHaveBeenCalledTimes(3);
    // user, assistant, tool_results, assistant, tool_results, assistant
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant", "user", "assistant"]);
    expect(messages[2].content.map((r) => r.tool_use_id)).toEqual(["a", "b"]);
  });

  it("puts the context block only in the first user message", async () => {
    const client = fakeClient([{ stop_reason: "end_turn", usage, content: [{ type: "text", text: "¿Qué juego?" }] }]);
    const messages = [];
    await runPlayAgent({ client, messages, userText: "jugamos", ctx, handlers: {} });
    expect(messages[0].content).toMatch(/<context>[\s\S]*today: 2026-10-30[\s\S]*<\/context>\n\njugamos/);

    client.messages.create.mockResolvedValueOnce({ stop_reason: "end_turn", usage, content: [{ type: "text", text: "ok" }] });
    await runPlayAgent({ client, messages, userText: "Azul", ctx, handlers: {} });
    expect(messages[2].content).toBe("Azul");
  });

  it("sends a fixed, cacheable system prompt and tools", async () => {
    const client = fakeClient([{ stop_reason: "end_turn", usage, content: [] }]);
    await runPlayAgent({ client, messages: [], userText: "hola", ctx, handlers: {} });
    const [params] = client.calls;
    expect(params.model).toBe(DEFAULT_MODEL);
    expect(params.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(params.system[0].text).not.toContain("2026-10-30");
    expect(params.tools.at(-1).cache_control).toEqual({ type: "ephemeral" });
    expect(params.max_tokens).toBeLessThanOrEqual(800);
  });

  it("marks failing and invalid tool results as errors without throwing", async () => {
    const handlers = {
      search_games: vi.fn(async () => { throw new Error("db down"); }),
      create_play_draft: vi.fn(async () => ({ ok: false, errors: ["playdate cannot be in the future"] })),
    };
    const client = fakeClient([
      { stop_reason: "tool_use", usage, content: [toolUse("a", "search_games", {}), toolUse("b", "create_play_draft", {}), toolUse("c", "nope", {})] },
      { stop_reason: "end_turn", usage, content: [{ type: "text", text: "¿Qué fecha?" }] },
    ]);
    const messages = [];
    const out = await runPlayAgent({ client, messages, userText: "x", ctx, handlers });
    const results = messages[2].content;
    expect(results.every((r) => r.is_error === true)).toBe(true);
    expect(results[0].content).not.toContain("db down");
    expect(out.status).toBe("active");
    expect(out.draft).toBeNull();
  });

  it("stops after the iteration cap", async () => {
    const loop = () => ({ stop_reason: "tool_use", usage, content: [toolUse("x", "search_games", { query: "a" })] });
    const client = fakeClient(Array.from({ length: MAX_ITERATIONS + 2 }, loop));
    const handlers = { search_games: vi.fn(async () => ({ results: [] })) };
    const out = await runPlayAgent({ client, messages: [], userText: "x", ctx, handlers });
    expect(client.messages.create).toHaveBeenCalledTimes(MAX_ITERATIONS);
    expect(out.status).toBe("limit_reached");
  });

  it("retries once with the fallback model on overload", async () => {
    const overloaded = Object.assign(new Error("overloaded"), { status: 529 });
    const client = fakeClient([overloaded, { stop_reason: "end_turn", usage, content: [{ type: "text", text: "ok" }] }]);
    const onUsage = vi.fn();
    const out = await runPlayAgent({ client, messages: [], userText: "x", ctx, onUsage, handlers: {} });
    expect(client.calls.map((c) => c.model)).toEqual([DEFAULT_MODEL, FALLBACK_MODEL]);
    expect(onUsage).toHaveBeenCalledWith(FALLBACK_MODEL, usage);
    expect(out.reply).toBe("ok");
  });

  it("does not retry a bad request", async () => {
    const bad = Object.assign(new Error("bad"), { status: 400 });
    const client = fakeClient([bad]);
    await expect(runPlayAgent({ client, messages: [], userText: "x", ctx, handlers: {} })).rejects.toThrow("bad");
    expect(client.messages.create).toHaveBeenCalledTimes(1);
  });
});

describe("runPlayAgent — ask_user", () => {
  const ask = (id, input) => ({ stop_reason: "tool_use", usage, content: [toolUse(id, "ask_user", input)] });
  const question = {
    question: "¿Cuál de estos juegos?",
    kind: "game",
    options: [
      { label: "Terraforming Mars", value: "167791", detail: "2016 · 11 partidas" },
      { label: "Terra Mystica", value: "120677", detail: "2012 · 9 partidas" },
    ],
  };

  it("stops the turn and returns the question with its options", async () => {
    const client = fakeClient([ask("q1", question)]);
    const out = await runPlayAgent({ client, messages: [], userText: "ayer Terra con Juan", ctx, handlers: {} });
    expect(out.reply).toBe("¿Cuál de estos juegos?");
    expect(out.question).toEqual({
      text: "¿Cuál de estos juegos?",
      kind: "game",
      options: [
        { label: "Terraforming Mars", value: "167791", detail: "2016 · 11 partidas" },
        { label: "Terra Mystica", value: "120677", detail: "2012 · 9 partidas" },
      ],
    });
    expect(out.pendingAsk).toMatchObject({ toolUseId: "q1", siblingResults: [] });
    expect(out.draft).toBeNull();
  });

  it("sends a tapped option back as the ask_user tool_result", async () => {
    const client = fakeClient([ask("q1", question), { stop_reason: "end_turn", usage, content: [{ type: "text", text: "ok" }] }]);
    const messages = [];
    const first = await runPlayAgent({ client, messages, userText: "ayer Terra", ctx, handlers: {} });
    await runPlayAgent({
      client,
      messages,
      userText: "Terra Mystica",
      ctx,
      handlers: {},
      pendingAsk: first.pendingAsk,
      choice: "120677",
    });
    const reply = messages[2];
    expect(reply.role).toBe("user");
    expect(reply.content).toEqual([
      {
        type: "tool_result",
        tool_use_id: "q1",
        content: JSON.stringify({ selected: { label: "Terra Mystica", value: "120677" } }),
      },
    ]);
  });

  it("sends typed text ('Otro') as a free answer", async () => {
    const client = fakeClient([ask("q1", question), { stop_reason: "end_turn", usage, content: [] }]);
    const messages = [];
    const first = await runPlayAgent({ client, messages, userText: "ayer Terra", ctx, handlers: {} });
    await runPlayAgent({ client, messages, userText: "Terra Nova", ctx, handlers: {}, pendingAsk: first.pendingAsk });
    expect(JSON.parse(messages[2].content[0].content)).toEqual({ answer: "Terra Nova" });
  });

  it("runs sibling tools and keeps their results for the answer turn", async () => {
    const handlers = { find_players: vi.fn(async () => ({ matches: [] })) };
    const client = fakeClient([
      {
        stop_reason: "tool_use",
        usage,
        content: [toolUse("f1", "find_players", { names: ["Juan"] }), toolUse("q1", "ask_user", question)],
      },
      { stop_reason: "end_turn", usage, content: [] },
    ]);
    const messages = [];
    const first = await runPlayAgent({ client, messages, userText: "x", ctx, handlers });
    expect(handlers.find_players).toHaveBeenCalled();
    expect(first.pendingAsk.siblingResults).toHaveLength(1);
    await runPlayAgent({ client, messages, userText: "Terra Mystica", ctx, handlers, pendingAsk: first.pendingAsk, choice: "120677" });
    expect(messages[2].content.map((r) => r.tool_use_id)).toEqual(["f1", "q1"]);
  });

  it("sanitizes the question: caps options, trims text and defaults the kind", () => {
    const q = sanitizeQuestion({
      question: "  ¿Quién?  ",
      kind: "raro",
      options: Array.from({ length: 8 }, (_, i) => ({ label: ` Ana ${i} `, value: `ana${i}` })).concat([{ label: "" }]),
    });
    expect(q.text).toBe("¿Quién?");
    expect(q.kind).toBe("other");
    expect(q.options).toHaveLength(5);
    expect(q.options[0]).toEqual({ label: "Ana 0", value: "ana0", detail: "" });
  });
});

describe("costUsd", () => {
  it("prices Haiku tokens including cache reads and writes", () => {
    const c = costUsd("claude-haiku-5-5", {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
      cache_creation_input_tokens: 0,
    });
    expect(c).toBeCloseTo(0.1 + 0.5 + 0.01, 6);
  });

  it("returns 0 for an unknown model", () => {
    expect(costUsd("other", { input_tokens: 5 })).toBe(0);
  });
});
