import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { compartidaTimeAgo } from "./compartidaTime";
import i18n from "../../i18n";

describe("compartidaTimeAgo", () => {
  const NOW = new Date("2026-05-18T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    i18n.changeLanguage("es");
  });

  it('returns "recién" for dates within a minute', () => {
    expect(compartidaTimeAgo(new Date(NOW))).toBe("recién");
    expect(compartidaTimeAgo(new Date(NOW - 30 * 1000))).toBe("recién");
  });

  it("formats minutes under an hour", () => {
    expect(compartidaTimeAgo(new Date(NOW - 5 * 60 * 1000))).toBe("hace 5m");
  });

  it("formats hours under a day", () => {
    expect(compartidaTimeAgo(new Date(NOW - 3 * 3600 * 1000))).toBe("hace 3h");
  });

  it("formats days under a week", () => {
    expect(compartidaTimeAgo(new Date(NOW - 2 * 86400 * 1000))).toBe("hace 2d");
  });

  it("formats a long date (same year, no year shown) for older dates", () => {
    // 2026-05-01 is >1 week before NOW and within the same year.
    const label = compartidaTimeAgo(new Date("2026-05-01T12:00:00Z"));
    expect(label).toContain("el ");
    expect(label).toMatch(/mayo/);
    expect(label).not.toMatch(/2026/);
  });

  it("includes the year for dates in a previous year", () => {
    const label = compartidaTimeAgo(new Date("2024-01-15T12:00:00Z"));
    expect(label).toMatch(/2024/);
  });

  it("respects the active language (en)", () => {
    i18n.changeLanguage("en");
    expect(compartidaTimeAgo(new Date(NOW))).toBe("just now");
    expect(compartidaTimeAgo(new Date(NOW - 5 * 60 * 1000))).toBe("5m ago");
  });
});
