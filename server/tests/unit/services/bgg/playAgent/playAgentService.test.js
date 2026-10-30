const { sanitizeFormContext, todayIn } = require("../../../../../services/bgg/playAgent/playAgentService");

describe("sanitizeFormContext", () => {
  it("keeps only the game, date and players the agent can use", () => {
    expect(
      sanitizeFormContext({
        game: { id: "13", name: "Catan", image: "x" },
        playdate: "2026-10-29",
        players: [{ name: "Juan", username: "juanp", score: 9 }, { name: "" }],
        location: "ignored",
      }),
    ).toEqual({
      game: { id: "13", name: "Catan" },
      playdate: "2026-10-29",
      players: [{ name: "Juan", username: "juanp" }],
    });
  });

  it("drops malformed values and returns null when nothing is left", () => {
    expect(sanitizeFormContext({ game: { id: "abc" }, playdate: "ayer" })).toBeNull();
    expect(sanitizeFormContext("nope")).toBeNull();
  });
});

describe("todayIn", () => {
  it("returns an ISO date and falls back on an invalid timezone", () => {
    expect(todayIn("America/Argentina/Buenos_Aires")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(todayIn("Not/AZone")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
