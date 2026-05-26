const { computePlayHash } = require("../../../utils/bggHash");

function basePlay() {
  return {
    playId: "123",
    date: "2026-05-01",
    quantity: 1,
    duration: 60,
    location: "casa",
    comments: "partida épica",
    incomplete: false,
    nowinstats: false,
    players: [
      {
        name: "Ana",
        username: "ana",
        userid: 1,
        position: "1",
        color: "red",
        score: "42",
        win: true,
        new: false,
        rating: 8,
      },
      {
        name: "Beto",
        username: "beto",
        userid: 2,
        position: "2",
        color: "blue",
        score: "30",
        win: false,
        new: false,
        rating: 7,
      },
    ],
  };
}

describe("utils/bggHash — computePlayHash", () => {
  it("is deterministic for the same input", () => {
    const p = basePlay();
    expect(computePlayHash(p)).toBe(computePlayHash(p));
  });

  it("produces a sha1 hex string (40 chars)", () => {
    const h = computePlayHash(basePlay());
    expect(h).toMatch(/^[0-9a-f]{40}$/);
  });

  it("returns the same hash for two structurally equal plays (different object refs)", () => {
    const a = basePlay();
    const b = JSON.parse(JSON.stringify(a));
    expect(computePlayHash(a)).toBe(computePlayHash(b));
  });

  it("does NOT depend on key order in the input object", () => {
    const a = basePlay();
    const reordered = {
      players: a.players,
      nowinstats: a.nowinstats,
      incomplete: a.incomplete,
      comments: a.comments,
      location: a.location,
      duration: a.duration,
      quantity: a.quantity,
      date: a.date,
      playId: a.playId,
    };
    expect(computePlayHash(reordered)).toBe(computePlayHash(a));
  });

  it.each([
    ["playId", { playId: "999" }],
    ["date", { date: "2026-05-02" }],
    ["quantity", { quantity: 2 }],
    ["duration", { duration: 90 }],
    ["location", { location: "club" }],
    ["comments", { comments: "otra cosa" }],
    ["incomplete", { incomplete: true }],
    ["nowinstats", { nowinstats: true }],
  ])("changes when %s changes", (_label, patch) => {
    const before = computePlayHash(basePlay());
    const after = computePlayHash({ ...basePlay(), ...patch });
    expect(after).not.toBe(before);
  });

  it("changes when a player is added", () => {
    const before = computePlayHash(basePlay());
    const modified = basePlay();
    modified.players.push({
      name: "Cris",
      username: "cris",
      userid: 3,
      position: "3",
      color: "green",
      score: "20",
      win: false,
      new: true,
      rating: null,
    });
    expect(computePlayHash(modified)).not.toBe(before);
  });

  it("changes when a player is removed", () => {
    const before = computePlayHash(basePlay());
    const modified = basePlay();
    modified.players.pop();
    expect(computePlayHash(modified)).not.toBe(before);
  });

  it.each([
    ["name", { name: "Anita" }],
    ["username", { username: "analu" }],
    ["userid", { userid: 999 }],
    ["position", { position: "2" }],
    ["color", { color: "green" }],
    ["score", { score: "100" }],
    ["win", { win: false }],
    ["new", { new: true }],
    ["rating", { rating: 10 }],
  ])("changes when a player %s changes", (_label, patch) => {
    const before = computePlayHash(basePlay());
    const modified = basePlay();
    modified.players[0] = { ...modified.players[0], ...patch };
    expect(computePlayHash(modified)).not.toBe(before);
  });

  it("changes when players are reordered (order is significant)", () => {
    const before = computePlayHash(basePlay());
    const modified = basePlay();
    modified.players = [modified.players[1], modified.players[0]];
    expect(computePlayHash(modified)).not.toBe(before);
  });

  it("ignores extra keys on the play object", () => {
    const a = basePlay();
    const b = {
      ...basePlay(),
      gameId: "13",
      gameName: "Catan",
      gameThumbnail: "http://x",
      bggUsername: "ana",
      createdAt: new Date(),
    };
    expect(computePlayHash(b)).toBe(computePlayHash(a));
  });

  it("ignores extra keys on player objects", () => {
    const a = basePlay();
    const b = basePlay();
    b.players[0] = { ...b.players[0], extra: "ignored" };
    expect(computePlayHash(b)).toBe(computePlayHash(a));
  });

  it("treats undefined and null the same for missing fields", () => {
    const withUndef = {
      ...basePlay(),
      location: undefined,
      comments: undefined,
    };
    const withNull = { ...basePlay(), location: null, comments: null };
    expect(computePlayHash(withUndef)).toBe(computePlayHash(withNull));
  });

  it("handles a play with zero players", () => {
    const empty = { ...basePlay(), players: [] };
    expect(computePlayHash(empty)).toMatch(/^[0-9a-f]{40}$/);
    expect(computePlayHash(empty)).not.toBe(computePlayHash(basePlay()));
  });

  it("handles comments with special characters", () => {
    const a = computePlayHash({
      ...basePlay(),
      comments: 'línea 1\nlínea 2 — ñandú 🎲 "quoted" \\backslash',
    });
    const b = computePlayHash({
      ...basePlay(),
      comments: 'línea 1\nlínea 2 — ñandú 🎲 "quoted" \\backslash',
    });
    const c = computePlayHash({
      ...basePlay(),
      comments: 'línea 1\nlínea 2 — ñandú 🎲 "quoted" \\backslash ',
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("handles missing players field (falls back to empty array)", () => {
    const noPlayers = { ...basePlay(), players: undefined };
    const empty = { ...basePlay(), players: [] };
    expect(computePlayHash(noPlayers)).toBe(computePlayHash(empty));
  });

  it("handles a totally minimal play (only playId and date)", () => {
    const minimal = { playId: "1", date: "2026-01-01" };
    expect(computePlayHash(minimal)).toMatch(/^[0-9a-f]{40}$/);
  });
});
