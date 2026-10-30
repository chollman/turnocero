const { matchPlayerNames } = require("../../../../../services/bgg/playAgent/matching");

const coPlayers = [
  { name: "Juan Pérez", username: "juanp", numPlays: 40, lastPlayedDate: "2026-10-20" },
  { name: "Melina Gómez", username: "meli_g", numPlays: 12, lastPlayedDate: "2026-10-01" },
  { name: "Melisa Ruiz", username: "", numPlays: 3, lastPlayedDate: "2026-09-01" },
  { name: "Pedro", username: "pedrito", numPlays: 8, lastPlayedDate: "2026-08-15" },
];

describe("matchPlayerNames", () => {
  it("matches an exact BGG username with exact confidence", () => {
    const [m] = matchPlayerNames(["pedrito"], coPlayers);
    expect(m.candidates[0]).toMatchObject({ username: "pedrito", confidence: "exact" });
  });

  it("ignores accents and case for exact names", () => {
    const [m] = matchPlayerNames(["juan perez"], coPlayers);
    expect(m.candidates[0]).toMatchObject({ username: "juanp", confidence: "exact" });
  });

  it("matches the start of any word as prefix", () => {
    const [m] = matchPlayerNames(["Juan"], coPlayers);
    expect(m.candidates).toHaveLength(1);
    expect(m.candidates[0]).toMatchObject({ name: "Juan Pérez", confidence: "prefix" });
  });

  it("returns every ambiguous candidate, most played first", () => {
    const [m] = matchPlayerNames(["Meli"], coPlayers);
    expect(m.candidates.map((c) => c.name)).toEqual(["Melina Gómez", "Melisa Ruiz"]);
  });

  it("finds substrings as fuzzy only for queries of 3+ chars", () => {
    expect(matchPlayerNames(["dri"], coPlayers)[0].candidates[0]).toMatchObject({
      username: "pedrito",
      confidence: "fuzzy",
    });
    expect(matchPlayerNames(["dr"], coPlayers)[0].candidates).toEqual([]);
  });

  it("returns no candidates for an unknown guest", () => {
    const [m] = matchPlayerNames(["Rocío"], coPlayers);
    expect(m).toEqual({ spoken: "Rocío", candidates: [] });
  });

  it("caps candidates at three", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ name: `Ana ${i}`, numPlays: i }));
    expect(matchPlayerNames(["ana"], many)[0].candidates).toHaveLength(3);
  });
});
