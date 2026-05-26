import { describe, it, expect } from "vitest";
import { mesaHorizon, groupByHorizon } from "./mesaHorizon";

const D = (year, month, day, hour = 12, minute = 0) =>
  new Date(year, month - 1, day, hour, minute);

describe("mesaHorizon", () => {
  const NOW = D(2026, 5, 20, 10, 0);

  it("returns 'today' for any time on the same calendar day", () => {
    expect(mesaHorizon(D(2026, 5, 20, 0, 30), NOW)).toBe("today");
    expect(mesaHorizon(D(2026, 5, 20, 23, 45), NOW)).toBe("today");
  });

  it("returns 'tomorrow' for the next day, even if only minutes ahead", () => {
    expect(mesaHorizon(D(2026, 5, 21, 0, 30), NOW)).toBe("tomorrow");
  });

  it("returns 'thisWeek' for days 2..7 ahead", () => {
    expect(mesaHorizon(D(2026, 5, 22), NOW)).toBe("thisWeek");
    expect(mesaHorizon(D(2026, 5, 27), NOW)).toBe("thisWeek");
  });

  it("returns 'later' for >7 days ahead", () => {
    expect(mesaHorizon(D(2026, 5, 28), NOW)).toBe("later");
    expect(mesaHorizon(D(2027, 1, 1), NOW)).toBe("later");
  });

  it("returns 'past' for any day before today", () => {
    expect(mesaHorizon(D(2026, 5, 19, 23, 59), NOW)).toBe("past");
    expect(mesaHorizon(D(2026, 5, 1), NOW)).toBe("past");
  });

  it("handles invalid input gracefully", () => {
    expect(mesaHorizon(null, NOW)).toBe("later");
    expect(mesaHorizon("nonsense", NOW)).toBe("later");
    expect(mesaHorizon(undefined, NOW)).toBe("later");
  });
});

describe("groupByHorizon", () => {
  const NOW = D(2026, 5, 20, 10, 0);

  it("only returns groups that have items, in fixed order", () => {
    const tables = [
      { _id: "a", date: D(2026, 5, 25, 18) },
      { _id: "b", date: D(2026, 5, 20, 19) },
      { _id: "c", date: D(2026, 5, 27, 21) },
    ];
    const groups = groupByHorizon(tables, (t) => t.date, NOW);
    expect(groups.map((g) => g.key)).toEqual(["today", "thisWeek"]);
  });

  it("sorts items within each group by date descending (most recent first)", () => {
    const tables = [
      { _id: "late", date: D(2026, 5, 25, 22) },
      { _id: "mid", date: D(2026, 5, 22, 18) },
      { _id: "early", date: D(2026, 5, 21, 9) },
    ];
    const groups = groupByHorizon(tables, (t) => t.date, NOW);
    const tomorrow = groups.find((g) => g.key === "tomorrow");
    const thisWeek = groups.find((g) => g.key === "thisWeek");
    expect(tomorrow.items.map((t) => t._id)).toEqual(["early"]);
    expect(thisWeek.items.map((t) => t._id)).toEqual(["late", "mid"]);
  });

  it("supports a custom date accessor", () => {
    const items = [{ id: 1, when: D(2026, 5, 20, 18) }];
    const groups = groupByHorizon(items, (i) => i.when, NOW);
    expect(groups[0].key).toBe("today");
    expect(groups[0].items).toHaveLength(1);
  });
});
