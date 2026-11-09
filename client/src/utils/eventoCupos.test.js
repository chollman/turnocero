import { describe, it, expect } from "vitest";
import { getOccupiedSpots, getReservedSpots } from "./eventoCupos";

describe("getReservedSpots", () => {
  it("returns 0 for missing, null, negative or invalid values", () => {
    expect(getReservedSpots(undefined)).toBe(0);
    expect(getReservedSpots({})).toBe(0);
    expect(getReservedSpots({ reservedSpots: null })).toBe(0);
    expect(getReservedSpots({ reservedSpots: -3 })).toBe(0);
    expect(getReservedSpots({ reservedSpots: "abc" })).toBe(0);
  });

  it("returns the numeric value when positive", () => {
    expect(getReservedSpots({ reservedSpots: 4 })).toBe(4);
    expect(getReservedSpots({ reservedSpots: "2" })).toBe(2);
  });
});

describe("getOccupiedSpots", () => {
  it("sums pending + confirmed from registrationCount plus reserved spots", () => {
    const evento = {
      reservedSpots: 3,
      registrationCount: { pending: 2, confirmed: 5, total: 9 },
    };
    expect(getOccupiedSpots(evento)).toBe(10);
  });

  it("works without registrationCount or reservedSpots", () => {
    expect(getOccupiedSpots({})).toBe(0);
    expect(getOccupiedSpots({ reservedSpots: 2 })).toBe(2);
  });

  it("accepts explicit counts (e.g. computed from the registrations array)", () => {
    expect(
      getOccupiedSpots({ reservedSpots: 1 }, { pending: 1, confirmed: 2 }),
    ).toBe(4);
  });
});
