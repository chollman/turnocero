const CASES = require("../../../eval/playLogger/cases");
const fx = require("../../../eval/playLogger/fixtures");
const { compareDraft, judgeCase } = require("../../../eval/playLogger/compare");
const { makeFixtureHandlers } = require("../../../eval/playLogger/fixtureHandlers");
const { expectedToToolInput } = require("../../../eval/playLogger/oracle");
const { runCase, parseArgs } = require("../../../eval/playLogger/run");

// La evaluación real llama a la API (npm run eval:agent). Acá se prueba todo lo
// que la rodea sin red: que los casos estén bien escritos, que el comparador
// sea correcto y que el runner arme bien una corrida con un cliente falso.

describe("eval cases", () => {
  it("has 32 cases with unique ids", () => {
    expect(CASES).toHaveLength(32);
    expect(new Set(CASES.map((c) => c.id)).size).toBe(32);
  });

  it("only references games and people that exist in the fixtures", () => {
    const usernames = new Set([fx.OWNER.username, ...fx.CO_PLAYERS.map((p) => p.username).filter(Boolean)]);
    for (const c of CASES.filter((x) => x.expect.kind === "draft")) {
      expect(fx.gameById(c.expect.draft.gameId), c.id).not.toBeNull();
      for (const p of c.expect.draft.players) {
        if (p.username) expect(usernames.has(p.username), `${c.id}: ${p.username}`).toBe(true);
      }
      expect(c.expect.draft.players.some((p) => p.username === fx.OWNER.username), c.id).toBe(true);
    }
  });

  it.each(CASES.filter((c) => c.expect.kind === "draft").map((c) => [c.id, c]))(
    "%s: a perfect agent would pass it",
    async (_id, c) => {
      const handlers = makeFixtureHandlers();
      const result = await handlers.create_play_draft(expectedToToolInput(c.expect.draft));
      expect(result.errors).toEqual([]);
      expect(judgeCase(c, { firstTurn: { draft: result.draft }, final: { draft: result.draft } })).toEqual({
        ok: true,
        diffs: [],
      });
    },
  );
});

describe("compareDraft", () => {
  const draft = {
    game: { id: "178900" },
    details: { playdate: "2026-10-30", location: "Casa de Juan", comments: "La revancha" },
    mode: "equipos",
    variant: "Mapa de Invierno",
    expansions: [{ id: "2" }, { id: "1" }],
    players: [
      { name: "Claudio", username: "claudio", team: "B", win: true, score: "10", faction: "" },
      { name: "Juan", username: "juanp", team: "B", win: true, score: "", faction: "" },
      { name: "Rocío", username: "", team: "A", win: false, score: "", faction: "" },
    ],
  };

  it("matches teams by grouping, not by letter", () => {
    const r = compareDraft(
      {
        players: [
          { username: "claudio", team: "A" },
          { username: "juanp", team: "A" },
          { name: "rocio", team: "B" },
        ],
      },
      draft,
    );
    expect(r).toEqual({ ok: true, diffs: [] });
  });

  it("detects players split across the wrong teams", () => {
    const r = compareDraft(
      {
        players: [
          { username: "claudio", team: "A" },
          { username: "juanp", team: "B" },
          { name: "Rocío", team: "B" },
        ],
      },
      draft,
    );
    expect(r.ok).toBe(false);
  });

  it("compares text fields by content and expansions as a set", () => {
    expect(
      compareDraft({ variant: "invierno", location: "juan", notesIncludes: "REVANCHA", expansions: ["1", "2"] }, draft).ok,
    ).toBe(true);
    expect(compareDraft({ expansions: ["1"] }, draft).diffs[0]).toMatch(/expansions/);
  });

  it("reports missing, extra and wrong players", () => {
    const r = compareDraft(
      { players: [{ username: "claudio", score: 9, win: false }, { username: "pedrito" }] },
      draft,
    );
    expect(r.diffs.join("\n")).toMatch(/players: expected/);
    expect(r.diffs.join("\n")).toMatch(/u:claudio.score: expected 9/);
    expect(r.diffs.join("\n")).toMatch(/u:claudio.win: expected false/);
  });

  it("checks the kind of a button question when askKind is set", () => {
    const c = { expect: { kind: "noDraft", askKind: "game" } };
    const q = (kind, n = 2) => ({ draft: null, question: { kind, options: Array.from({ length: n }, () => ({})) } });
    expect(judgeCase(c, { firstTurn: q("game") }).ok).toBe(true);
    expect(judgeCase(c, { firstTurn: q("player") }).ok).toBe(false);
    expect(judgeCase(c, { firstTurn: q("game", 1) }).ok).toBe(false);
    expect(judgeCase(c, { firstTurn: { draft: null, question: null } }).diffs[0]).toMatch(/plain-text/);
  });

  it("fails without a draft and when a question was expected", () => {
    expect(compareDraft({}, null).ok).toBe(false);
    const c = { expect: { kind: "noDraft" } };
    expect(judgeCase(c, { firstTurn: { draft: null } }).ok).toBe(true);
    expect(judgeCase(c, { firstTurn: { draft: {} } }).ok).toBe(false);
  });
});

describe("fixture handlers", () => {
  const h = makeFixtureHandlers();

  it("searches my games first and falls back to the BGG catalog", async () => {
    expect((await h.search_games({ query: "azul" })).results[0]).toMatchObject({ id: "230802", source: "my_games" });
    expect((await h.search_games({ query: "arcs" })).results).toEqual([
      expect.objectContaining({ id: "359871", source: "bgg" }),
    ]);
  });

  it("makes 'Meli' ambiguous and resolves nicknames", async () => {
    const { matches } = await h.find_players({ names: ["Meli", "Tincho", "Rocío"] });
    expect(matches[0].candidates).toHaveLength(2);
    expect(matches[1].candidates[0]).toMatchObject({ username: "tincho", confidence: "exact" });
    expect(matches[2].candidates).toEqual([]);
  });

  it("returns English expansion names that a Spanish query won't match", async () => {
    expect((await h.get_game_variants({ gameId: "13", query: "navegantes" })).expansions).toEqual([]);
    expect((await h.get_game_variants({ gameId: "13" })).expansions[0]).toMatchObject({ id: "325" });
  });
});

describe("runner", () => {
  it("parses flags", () => {
    expect(parseArgs(["--dry", "--only=equipos"])).toEqual({ dry: true, only: "equipos" });
  });

  it("simulates a button tap when the next turn matches an option", async () => {
    const usage = { input_tokens: 100, output_tokens: 10 };
    const c = CASES.find((x) => x.id === "juego-ambiguo-respuesta");
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
              question: "¿Cuál?",
              kind: "game",
              options: [
                { label: "Terraforming Mars", value: "167791" },
                { label: "Terra Mystica", value: "120677" },
              ],
            },
          },
        ],
      },
      {
        stop_reason: "tool_use",
        usage,
        content: [{ type: "tool_use", id: "t1", name: "create_play_draft", input: expectedToToolInput(c.expect.draft) }],
      },
      { stop_reason: "end_turn", usage, content: [{ type: "text", text: "Listo." }] },
    ];
    const client = {
      messages: {
        create: vi.fn(async (p) => {
          calls.push(JSON.parse(JSON.stringify(p.messages)));
          return responses.shift();
        }),
      },
    };
    const r = await runCase(client, c);
    expect(r).toMatchObject({ ok: true, userTurns: 2 });
    expect(r.turns[1].choice).toBe("120677");
    expect(JSON.parse(calls[1].at(-1).content[0].content)).toEqual({ selected: { label: "Terra Mystica", value: "120677" } });
  });

  it("runs a multi-turn case with a scripted client and judges it", async () => {
    const usage = { input_tokens: 1000, output_tokens: 50 };
    const c = CASES.find((x) => x.id === "jugador-ambiguo-respuesta");
    const responses = [
      { stop_reason: "end_turn", usage, content: [{ type: "text", text: "¿Melina o Melisa?" }] },
      {
        stop_reason: "tool_use",
        usage,
        content: [{ type: "tool_use", id: "t1", name: "create_play_draft", input: expectedToToolInput(c.expect.draft) }],
      },
      { stop_reason: "end_turn", usage, content: [{ type: "text", text: "Listo." }] },
    ];
    const client = { messages: { create: vi.fn(async () => responses.shift()) } };

    const r = await runCase(client, c);
    expect(r).toMatchObject({ id: c.id, ok: true, userTurns: 2 });
    expect(r.usage.calls).toBe(3);
    expect(r.usage.cost).toBeGreaterThan(0);
  });

  it("counts an API error as a failed case", async () => {
    const client = { messages: { create: vi.fn(async () => { throw Object.assign(new Error("bad"), { status: 400 }); }) } };
    const r = await runCase(client, CASES[0]);
    expect(r.ok).toBe(false);
    expect(r.diffs[0]).toMatch(/error: 400 bad/);
  });
});
