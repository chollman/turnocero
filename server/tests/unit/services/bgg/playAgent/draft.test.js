const { validateDraft } = require("../../../../../services/bgg/playAgent/draft");

const ctx = { today: "2026-10-30", ownerUsername: "Claudio", game: { minPlayers: 2, maxPlayers: 4 } };
const me = { name: "Claudio", username: "claudio" };
const base = (over = {}) => ({
  gameId: "266192",
  gameName: "Wingspan",
  playdate: "2026-10-29",
  mode: "versus",
  players: [
    { ...me, score: 72 },
    { name: "Juan", username: "juanp", score: 87, win: true },
  ],
  ...over,
});

describe("validateDraft", () => {
  it("accepts a valid competitive play and shapes it for PlayForm", () => {
    const r = validateDraft(base({ length: 100, location: "Casa" }), ctx);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.draft).toMatchObject({
      game: { id: "266192", name: "Wingspan" },
      details: { playdate: "2026-10-29", length: 100, location: "Casa" },
      mode: "versus",
      players: [
        { name: "Claudio", username: "claudio", score: "72", win: false },
        { name: "Juan", username: "juanp", score: "87", win: true },
      ],
    });
  });

  it.each([
    [{ gameId: "abc" }, "gameId"],
    [{ playdate: "2026-02-30" }, "playdate"],
    [{ playdate: "2026-11-01" }, "future"],
    [{ players: [] }, "at least one player"],
    [{ length: -5 }, "length"],
  ])("rejects %j", (over, msg) => {
    const r = validateDraft(base(over), ctx);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain(msg);
  });

  it("requires the account owner among the players (case-insensitive)", () => {
    const r = validateDraft(base({ players: [{ name: "Juan", username: "juanp" }] }), ctx);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("account owner");
  });

  it("warns when the winner is not the top score", () => {
    const r = validateDraft(
      base({ players: [{ ...me, score: 90, win: false }, { name: "Juan", username: "juanp", score: 80, win: true }] }),
      ctx,
    );
    expect(r.ok).toBe(true);
    expect(r.warnings.join(" ")).toContain("highest score");
  });

  it("warns when the player count is outside the game's range", () => {
    const players = ["a", "b", "c", "d"].map((n) => ({ name: n }));
    const r = validateDraft(base({ players: [me, ...players] }), ctx);
    expect(r.warnings.join(" ")).toContain("at most 4");
  });

  it("forces everyone to win or lose together in coop and drops scores", () => {
    const r = validateDraft(base({ mode: "coop", coopResult: "lost" }), ctx);
    expect(r.ok).toBe(true);
    expect(r.draft.coopResult).toBe("lost");
    expect(r.draft.players.every((p) => p.win === false && p.score === "")).toBe(true);
  });

  it("requires a team for every player in equipos mode and drops factions", () => {
    const bad = validateDraft(base({ mode: "equipos" }), ctx);
    expect(bad.errors.join(" ")).toContain("team");

    const ok = validateDraft(
      base({
        mode: "equipos",
        players: [
          { ...me, team: "a", win: true, faction: "Águilas" },
          { name: "Juan", username: "juanp", team: "B" },
        ],
      }),
      ctx,
    );
    expect(ok.ok).toBe(true);
    expect(ok.draft.players.map((p) => [p.team, p.faction])).toEqual([["A", ""], ["B", ""]]);
  });

  it("keeps factions in versus mode and warns on duplicates", () => {
    const r = validateDraft(
      base({
        players: [
          { ...me, faction: "Marquesa" },
          { name: "Juan", username: "juanp", faction: "marquesa", win: true },
        ],
      }),
      ctx,
    );
    expect(r.draft.players[0].faction).toBe("Marquesa");
    expect(r.warnings.join(" ")).toContain("same faction");
  });

  it("warns about a possible duplicate play", () => {
    const r = validateDraft(base(), { ...ctx, duplicateSameDay: true });
    expect(r.warnings.join(" ")).toContain("duplicate");
  });

  it("keeps only well-formed expansions", () => {
    const r = validateDraft(
      base({ expansions: [{ id: "300905", name: "European Expansion" }, { id: "x", name: "bad" }] }),
      ctx,
    );
    expect(r.draft.expansions).toEqual([{ id: "300905", name: "European Expansion" }]);
  });
});
