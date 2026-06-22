import { describe, it, expect, afterEach } from "vitest";
import { getLocale, formatNumber, formatDate, formatTime } from "./locale";
import i18n from "../i18n";

afterEach(() => {
  i18n.changeLanguage("es");
});

describe("locale", () => {
  it("getLocale mapea el idioma activo a un locale BCP-47", () => {
    i18n.changeLanguage("es");
    expect(getLocale()).toBe("es-AR");
    i18n.changeLanguage("en");
    expect(getLocale()).toBe("en-US");
  });

  it("formatNumber usa el separador decimal del locale", () => {
    i18n.changeLanguage("es");
    expect(
      formatNumber(12.3, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    ).toBe("12,3");
    i18n.changeLanguage("en");
    expect(
      formatNumber(12.3, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    ).toBe("12.3");
  });

  it("formatDate / formatTime aceptan Date o string parseable", () => {
    const iso = "2026-01-15T14:30:00";
    i18n.changeLanguage("es");
    // Mes corto en español (sin asertar el string exacto, que depende de ICU).
    expect(typeof formatDate(iso, { month: "short" })).toBe("string");
    expect(formatDate(new Date(iso), { month: "short" })).toBe(
      formatDate(iso, { month: "short" }),
    );
    expect(
      formatTime(iso, { hour: "2-digit", minute: "2-digit", hour12: false }),
    ).toContain("14:30");
  });
});
