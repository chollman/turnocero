import { describe, it, expect } from "vitest";
import { getInitials } from "./initials";

describe("getInitials", () => {
  it("returns the first letter of username (uppercased)", () => {
    expect(getInitials({ username: "claudio" })).toBe("C");
  });

  it('uses two-word displayName for first+first initials (CH for "Claudio Hollman")', () => {
    expect(
      getInitials({ displayName: "Claudio Hollman", username: "cha" }),
    ).toBe("CH");
  });

  it("falls back to first letter of username when displayName is a single word", () => {
    // username wins over single-word displayName (so the same letter is used everywhere)
    expect(getInitials({ displayName: "Cha", username: "whatever" })).toBe("W");
  });

  it("uses displayName first letter when username is missing", () => {
    expect(getInitials({ displayName: "Cha" })).toBe("C");
  });

  it('returns "?" when nothing is provided', () => {
    expect(getInitials({})).toBe("?");
    expect(getInitials({ username: "" })).toBe("?");
  });

  it("handles unicode safely (no broken grapheme clusters)", () => {
    expect(getInitials({ username: "ñandú" })).toBe("Ñ");
    expect(getInitials({ username: "🦊rojo" })).toBe("🦊".toUpperCase());
  });

  it("uses .name as a secondary fallback when displayName is missing", () => {
    expect(getInitials({ name: "Maria Curie" })).toBe("MC");
  });

  it("trims leading/trailing whitespace", () => {
    expect(getInitials({ displayName: "  Ada Lovelace  " })).toBe("AL");
  });
});
