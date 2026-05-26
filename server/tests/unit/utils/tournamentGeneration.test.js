const {
  generateLeagueFixture,
  generateSingleElimBracket,
  computeStandings,
  generateGroupsPhase,
  computeGroupStandings,
  validateNextPhase,
} = require("../../../utils/tournamentGeneration");

const ids = (n) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

describe("generateLeagueFixture", () => {
  it("returns empty for fewer than 2 players", () => {
    expect(generateLeagueFixture([])).toEqual([]);
    expect(generateLeagueFixture(["p1"])).toEqual([]);
  });

  it("round-robin: 4 players → 3 rounds × 2 matches = 6 matches, every pair appears once", () => {
    const m = generateLeagueFixture(ids(4));
    expect(m.length).toBe(6);
    const rounds = new Set(m.map((x) => x.round));
    expect(rounds.size).toBe(3);

    // Every pair must appear exactly once.
    const pairs = new Set();
    for (const match of m) {
      const key = [match.playerA, match.playerB].sort().join("|");
      expect(pairs.has(key)).toBe(false);
      pairs.add(key);
    }
    expect(pairs.size).toBe(6); // C(4,2)
  });

  it('odd player count introduces a BYE per round (status: "bye", playerB null)', () => {
    const m = generateLeagueFixture(ids(3));
    // n=4 internal (1 bye added), rounds=3, matches per round=2 → 6 matches total
    expect(m.length).toBe(6);
    const byes = m.filter((x) => x.status === "bye");
    // Each round should contain exactly 1 bye.
    expect(byes.length).toBe(3);
    byes.forEach((b) => {
      expect(b.playerB === null || b.playerA === null).toBe(true);
      expect(b.winner).toBeTruthy(); // the non-null player wins by default
    });
  });
});

describe("generateSingleElimBracket", () => {
  it("returns empty for fewer than 2 players", () => {
    expect(generateSingleElimBracket([])).toEqual([]);
    expect(generateSingleElimBracket(["p1"])).toEqual([]);
  });

  it("4 players → 3 matches in 2 rounds, no play-in", () => {
    const m = generateSingleElimBracket(ids(4));
    expect(m.length).toBe(3);
    const rounds = m.map((x) => x.round).sort();
    expect(rounds).toEqual([1, 1, 2]);
    const final = m.find((x) => x.round === 2);
    expect(final.nextMatchKey).toBeNull();
  });

  it("5 players → 1 play-in + 2 R1 + 1 final = 4 matches in 3 rounds", () => {
    const m = generateSingleElimBracket(ids(5));
    expect(m.length).toBe(4);
    const r1 = m.filter((x) => x.round === 1);
    const r2 = m.filter((x) => x.round === 2);
    const r3 = m.filter((x) => x.round === 3);
    expect(r1.length).toBe(1); // play-in
    expect(r2.length).toBe(2); // main R1 (semis-ish)
    expect(r3.length).toBe(1); // final
  });

  it("8 players → no play-in, 4 R1 + 2 SF + 1 final = 7 matches", () => {
    const m = generateSingleElimBracket(ids(8));
    expect(m.length).toBe(7);
    const byRound = m.reduce((acc, x) => {
      acc[x.round] = (acc[x.round] || 0) + 1;
      return acc;
    }, {});
    expect(byRound).toEqual({ 1: 4, 2: 2, 3: 1 });
  });

  it("10 players → 2 play-in + 4 QF + 2 SF + 1 final = 9 matches", () => {
    const m = generateSingleElimBracket(ids(10));
    expect(m.length).toBe(9);
    const byRound = m.reduce((acc, x) => {
      acc[x.round] = (acc[x.round] || 0) + 1;
      return acc;
    }, {});
    expect(byRound).toEqual({ 1: 2, 2: 4, 3: 2, 4: 1 });
  });

  it("every non-final match has a nextMatchKey and isUpperSlot flag", () => {
    const m = generateSingleElimBracket(ids(8));
    for (const match of m) {
      if (match.round === 3) {
        expect(match.nextMatchKey).toBeNull();
      } else {
        expect(match.nextMatchKey).toMatch(/^\d+-\d+$/);
        expect(typeof match.isUpperSlot).toBe("boolean");
      }
    }
  });

  it("play-in winner advances to the correct slot in the main bracket", () => {
    const m = generateSingleElimBracket(ids(5));
    const playIn = m.find((x) => x.round === 1);
    expect(playIn.nextMatchKey).toMatch(/^2-\d+$/);
    // The play-in pairs seeds 4 and 5 (directSeeds = 2*4 - 5 = 3, so seeds 4..5).
    expect(playIn.playerA).toBe("p4");
    expect(playIn.playerB).toBe("p5");
  });

  it("top seeds (direct entry) appear in main R1 of a 5-player bracket", () => {
    const m = generateSingleElimBracket(ids(5));
    const mainR1 = m.filter((x) => x.round === 2);
    const allMainPlayers = mainR1
      .flatMap((x) => [x.playerA, x.playerB])
      .filter(Boolean);
    // Seeds 1, 2, 3 should appear directly; seed 4 and 5 enter through play-in.
    expect(allMainPlayers).toEqual(expect.arrayContaining(["p1", "p2", "p3"]));
    expect(allMainPlayers).not.toContain("p4");
    expect(allMainPlayers).not.toContain("p5");
  });
});

describe("computeStandings (league)", () => {
  const players = ids(3);

  it("returns zeroed stats for every participant when there are no matches", () => {
    const s = computeStandings([], players);
    expect(s.length).toBe(3);
    expect(s.every((x) => x.points === 0 && x.played === 0)).toBe(true);
  });

  it("3 points for a win, 0 for the loser", () => {
    const matches = [
      { status: "completed", playerA: "p1", playerB: "p2", winner: "p1" },
    ];
    const s = computeStandings(matches, players);
    const p1 = s.find((x) => x.user === "p1");
    const p2 = s.find((x) => x.user === "p2");
    expect(p1).toMatchObject({
      played: 1,
      won: 1,
      drawn: 0,
      lost: 0,
      points: 3,
    });
    expect(p2).toMatchObject({
      played: 1,
      won: 0,
      drawn: 0,
      lost: 1,
      points: 0,
    });
  });

  it("1 point each for a draw", () => {
    const matches = [
      {
        status: "completed",
        playerA: "p1",
        playerB: "p2",
        isDraw: true,
        winner: null,
      },
    ];
    const s = computeStandings(matches, players);
    const p1 = s.find((x) => x.user === "p1");
    const p2 = s.find((x) => x.user === "p2");
    expect(p1.points).toBe(1);
    expect(p2.points).toBe(1);
    expect(p1.drawn).toBe(1);
  });

  it("sorts by points desc, then wins desc, then id asc (stable tiebreaker)", () => {
    const matches = [
      // p1 beats p2 (p1: 3 pts, 1 win)
      { status: "completed", playerA: "p1", playerB: "p2", winner: "p1" },
      // p3 beats p2 (p3: 3 pts, 1 win) → p1 and p3 tied; tiebreak by id asc
      { status: "completed", playerA: "p3", playerB: "p2", winner: "p3" },
    ];
    const s = computeStandings(matches, players);
    expect(s.map((x) => x.user)).toEqual(["p1", "p3", "p2"]);
  });

  it("ignores byes (no stats recorded)", () => {
    const matches = [
      { status: "bye", playerA: "p1", playerB: null, winner: "p1" },
    ];
    const s = computeStandings(matches, players);
    expect(s.every((x) => x.played === 0)).toBe(true);
  });

  it("handles populated player objects ({_id})", () => {
    const matches = [
      {
        status: "completed",
        playerA: { _id: "p1" },
        playerB: { _id: "p2" },
        winner: { _id: "p1" },
      },
    ];
    const s = computeStandings(matches, players);
    expect(s.find((x) => x.user === "p1").points).toBe(3);
  });
});

describe("generateGroupsPhase", () => {
  it("returns empty for fewer than 2 players", () => {
    expect(generateGroupsPhase([], 4)).toEqual([]);
    expect(generateGroupsPhase(["p1"], 4)).toEqual([]);
  });

  it("clamps tableSize < 2 up to 2", () => {
    const g = generateGroupsPhase(ids(4), 1);
    // ceil(4/2) = 2 tables of 2
    expect(g.length).toBe(2);
  });

  it("8 players, tableSize 4 → 2 tables, snake distribution balances seeds", () => {
    const g = generateGroupsPhase(ids(8), 4);
    expect(g.length).toBe(2);
    // First table gets seeds 1, 4, 5, 8 (snake order); second gets 2, 3, 6, 7.
    expect(g[0].players).toEqual(["p1", "p4", "p5", "p8"]);
    expect(g[1].players).toEqual(["p2", "p3", "p6", "p7"]);
  });

  it("assigns sequential tableNumbers starting at 1", () => {
    const g = generateGroupsPhase(ids(12), 4);
    expect(g.map((x) => x.tableNumber)).toEqual([1, 2, 3]);
  });

  it("uneven counts: 9 players, tableSize 4 → 3 tables (with one short table)", () => {
    const g = generateGroupsPhase(ids(9), 4);
    expect(g.length).toBe(3);
    const total = g.reduce((sum, t) => sum + t.players.length, 0);
    expect(total).toBe(9);
  });
});

describe("computeGroupStandings", () => {
  const players = ids(4);

  it("returns zeros when there are no completed games", () => {
    const s = computeGroupStandings([], players);
    expect(s.length).toBe(4);
    expect(s.every((x) => x.totalPV === 0)).toBe(true);
  });

  it("sums PV across all completed games", () => {
    const games = [
      {
        status: "completed",
        gameNumber: 1,
        results: [
          { player: "p1", score: 10 },
          { player: "p2", score: 8 },
          { player: "p3", score: 6 },
          { player: "p4", score: 4 },
        ],
      },
      {
        status: "completed",
        gameNumber: 2,
        results: [
          { player: "p1", score: 7 },
          { player: "p2", score: 9 },
          { player: "p3", score: 5 },
          { player: "p4", score: 3 },
        ],
      },
    ];
    const s = computeGroupStandings(games, players);
    expect(s.find((x) => x.user === "p1").totalPV).toBe(17);
    expect(s.find((x) => x.user === "p2").totalPV).toBe(17);
    expect(s.find((x) => x.user === "p3").totalPV).toBe(11);
    expect(s.find((x) => x.user === "p4").totalPV).toBe(7);
  });

  it("orders by totalPV desc, then by seed order on ties", () => {
    const games = [
      {
        status: "completed",
        gameNumber: 1,
        results: [
          { player: "p1", score: 10 },
          { player: "p2", score: 10 }, // tie with p1 on PV; p1 must come first (seed)
          { player: "p3", score: 5 },
          { player: "p4", score: 0 },
        ],
      },
    ];
    const s = computeGroupStandings(games, players);
    expect(s.map((x) => x.user)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("records null in byGame for non-completed games", () => {
    const games = [{ status: "pending", gameNumber: 1, results: [] }];
    const s = computeGroupStandings(games, players);
    s.forEach((stat) => expect(stat.byGame).toEqual([null]));
  });
});

describe("validateNextPhase", () => {
  it("marks as final when advancedCount ≤ tableSize", () => {
    const r = validateNextPhase(4, 4);
    expect(r).toMatchObject({
      valid: true,
      isFinal: true,
      tables: 1,
      finalTableSize: 4,
    });
  });

  it("valid + multi-table when count divides cleanly", () => {
    const r = validateNextPhase(8, 4);
    expect(r).toMatchObject({
      valid: true,
      isFinal: false,
      tables: 2,
      finalTableSize: 4,
    });
  });

  it("invalid with suggestions when count does not divide cleanly", () => {
    const r = validateNextPhase(7, 4);
    expect(r.valid).toBe(false);
    expect(r.suggestions.length).toBeGreaterThan(0);
    // First suggestion: always offer one final table of all players.
    expect(r.suggestions[0]).toMatchObject({ overrideTableSize: 7, tables: 1 });
  });

  it("warns when there are zero promoted players", () => {
    const r = validateNextPhase(0, 4);
    expect(r.valid).toBe(false);
    expect(r.warnings.join(" ")).toMatch(/No hay jugadores/);
  });
});
