import { describe, it, expect } from "vitest";
import {
  NOTICIA_CATEGORIES,
  NOTICIA_SECTIONS,
  getCategory,
  categoryLabel,
  categoryColor,
  isLiveCategory,
} from "./noticiaCategories";

describe("noticiaCategories", () => {
  it("has a label and color for every category", () => {
    Object.values(NOTICIA_CATEGORIES).forEach((c) => {
      expect(c.label).toBeTruthy();
      expect(c.color).toMatch(/var\(--/);
    });
  });

  it("getCategory falls back to general for unknown keys", () => {
    expect(getCategory("zzz")).toBe(NOTICIA_CATEGORIES.general);
    expect(getCategory(undefined)).toBe(NOTICIA_CATEGORIES.general);
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
    expect(NOTICIA_SECTIONS[0]).toEqual({ id: "all", label: "Portada" });
    expect(NOTICIA_SECTIONS.find((s) => s.id === "general")).toBeUndefined();
    expect(NOTICIA_SECTIONS.find((s) => s.id === "resena")).toBeTruthy();
  });
});
