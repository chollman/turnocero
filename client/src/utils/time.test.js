import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatTimeAgo, formatExactDateTime } from "./time";

describe("formatTimeAgo", () => {
  const NOW = new Date("2026-05-18T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "recién" for dates within 45 seconds', () => {
    expect(formatTimeAgo(new Date(NOW - 30 * 1000))).toBe("recién");
    expect(formatTimeAgo(new Date(NOW))).toBe("recién");
  });

  it("formats minutes for ranges under an hour", () => {
    expect(formatTimeAgo(new Date(NOW - 5 * 60 * 1000))).toMatch(/min/i);
  });

  it("formats hours for ranges under a day", () => {
    expect(formatTimeAgo(new Date(NOW - 3 * 3600 * 1000))).toMatch(/h|hor/i);
  });

  it("formats days for ranges under a week", () => {
    // 2 days ago in es-AR with numeric: 'auto' is "anteayer"; 3 days ago is "hace 3 días".
    expect(formatTimeAgo(new Date(NOW - 3 * 86400 * 1000))).toMatch(/d[ií]a/i);
  });

  it("formats months for ranges over 30 days", () => {
    expect(formatTimeAgo(new Date(NOW - 60 * 86400 * 1000))).toMatch(/mes/i);
  });

  it("formats years for ranges over 365 days", () => {
    expect(formatTimeAgo(new Date(NOW - 400 * 86400 * 1000))).toMatch(
      /a[ñn]o/i,
    );
  });

  it("returns empty string for null/undefined/invalid", () => {
    expect(formatTimeAgo(null)).toBe("");
    expect(formatTimeAgo(undefined)).toBe("");
    expect(formatTimeAgo("not a date")).toBe("");
  });

  it("handles ISO strings as input", () => {
    const iso = new Date(NOW - 5 * 60 * 1000).toISOString();
    expect(formatTimeAgo(iso)).toBeTruthy();
  });
});

describe("formatExactDateTime", () => {
  const NOW = new Date("2026-05-18T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mismo día → solo la hora (24h)", () => {
    // Construido con componentes LOCALES para ser independiente del timezone.
    const d = new Date(NOW);
    d.setHours(14, 30, 0, 0);
    expect(formatExactDateTime(d)).toBe("a las 14:30");
  });

  it("padea hora y minutos a 2 dígitos", () => {
    const d = new Date(NOW);
    d.setHours(9, 5, 0, 0);
    expect(formatExactDateTime(d)).toBe("a las 09:05");
  });

  it("otro día (mismo año) → antepone la fecha D/M", () => {
    const d = new Date(NOW);
    d.setDate(d.getDate() - 3);
    d.setHours(9, 5, 0, 0);
    expect(formatExactDateTime(d)).toBe(
      `el ${d.getDate()}/${d.getMonth() + 1} a las 09:05`,
    );
  });

  it("otro año → incluye el año en la fecha", () => {
    const d = new Date(NOW);
    d.setFullYear(d.getFullYear() - 1);
    d.setHours(8, 0, 0, 0);
    expect(formatExactDateTime(d)).toBe(
      `el ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} a las 08:00`,
    );
  });

  it("acepta ISO strings", () => {
    const d = new Date(NOW);
    d.setHours(20, 15, 0, 0);
    expect(formatExactDateTime(d.toISOString())).toBe("a las 20:15");
  });

  it("devuelve string vacío para null/undefined/inválido", () => {
    expect(formatExactDateTime(null)).toBe("");
    expect(formatExactDateTime(undefined)).toBe("");
    expect(formatExactDateTime("not a date")).toBe("");
  });
});
