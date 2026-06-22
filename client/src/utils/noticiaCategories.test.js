import { describe, it, expect, afterEach } from "vitest";
import i18n from "../i18n";
import {
  getNoticiaCategories,
  getNoticiaSections,
  getCategory,
  categoryLabel,
  categoryColor,
  isLiveCategory,
} from "./noticiaCategories";

afterEach(() => {
  i18n.changeLanguage("es");
});

describe("noticiaCategories", () => {
  it("has a label and color for every category", () => {
    Object.values(getNoticiaCategories()).forEach((c) => {
      expect(c.label).toBeTruthy();
      expect(c.color).toMatch(/var\(--/);
    });
  });

  it("getCategory falls back to general for unknown keys", () => {
    expect(getCategory("zzz")).toEqual(getNoticiaCategories().general);
    expect(getCategory(undefined)).toEqual(getNoticiaCategories().general);
  });

  it("categoryLabel/categoryColor resolve known keys", () => {
    expect(categoryLabel("resena")).toBe("Reseña");
    expect(categoryColor("evento")).toBe("var(--orange)");
  });

  it("only envivo is live", () => {
    expect(isLiveCategory("envivo")).toBe(true);
    expect(isLiveCategory("evento")).toBe(false);
  });

  it("sections start with Portada (all) and exclude general", () => {
    const sections = getNoticiaSections();
    expect(sections[0]).toEqual({ id: "all", label: "Portada" });
    expect(sections.find((s) => s.id === "general")).toBeUndefined();
    expect(sections.find((s) => s.id === "resena")).toBeTruthy();
  });

  it("renders English labels when the language is 'en'", () => {
    i18n.changeLanguage("en");
    expect(categoryLabel("resena")).toBe("Review");
    expect(getNoticiaSections()[0]).toEqual({ id: "all", label: "Front page" });
    // Structural fields stay language-independent.
    expect(categoryColor("evento")).toBe("var(--orange)");
    expect(isLiveCategory("envivo")).toBe(true);
  });
});
