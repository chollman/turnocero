import { describe, it, expect } from "vitest";
import { formatDistanceKm } from "./distance";

describe("formatDistanceKm", () => {
  it("returns null for null/undefined", () => {
    expect(formatDistanceKm(null)).toBeNull();
    expect(formatDistanceKm(undefined)).toBeNull();
  });

  it("returns null for NaN/Infinity", () => {
    expect(formatDistanceKm(NaN)).toBeNull();
    expect(formatDistanceKm(Infinity)).toBeNull();
  });

  it('returns null for exactly 0km (no "Aquí mismo" badge — la dirección ya lo dice todo)', () => {
    expect(formatDistanceKm(0)).toBeNull();
  });

  it('returns null for distances that round to 0m (evita mostrar "0 m")', () => {
    expect(formatDistanceKm(0.001)).toBeNull(); // 1m → redondea a 0m
    expect(formatDistanceKm(0.004)).toBeNull(); // 4m → redondea a 0m
  });

  it("formats sub-kilometer distances in meters (rounded to 10m)", () => {
    expect(formatDistanceKm(0.01)).toBe("10 m"); // umbral mínimo visible
    expect(formatDistanceKm(0.85)).toBe("850 m");
    expect(formatDistanceKm(0.853)).toBe("850 m");
    expect(formatDistanceKm(0.857)).toBe("860 m");
    expect(formatDistanceKm(0.123)).toBe("120 m");
  });

  it("formats 1–99km with one decimal and AR comma", () => {
    expect(formatDistanceKm(1.23)).toBe("1,2 km");
    expect(formatDistanceKm(12.789)).toBe("12,8 km");
    expect(formatDistanceKm(99.4)).toBe("99,4 km");
  });

  it('formats >=100km as rounded integer with " km"', () => {
    expect(formatDistanceKm(100)).toBe("100 km");
    expect(formatDistanceKm(249.6)).toBe("250 km");
    expect(formatDistanceKm(1234.5)).toBe("1235 km");
  });
});
