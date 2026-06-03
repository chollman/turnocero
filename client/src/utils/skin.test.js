import { describe, it, expect } from "vitest";
import { buildSkinCss, cssVarName } from "./skin";

describe("cssVarName", () => {
  it("maps camelCase keys to kebab CSS vars", () => {
    expect(cssVarName("amber")).toBe("--amber");
    expect(cssVarName("bgCard")).toBe("--bg-card");
    expect(cssVarName("textPrimary")).toBe("--text-primary");
    expect(cssVarName("borderStrong")).toBe("--border-strong");
    // Texto sobre botones primarios.
    expect(cssVarName("onAmber")).toBe("--on-amber");
  });
});

describe("buildSkinCss", () => {
  it("returns empty string without slug or skin", () => {
    expect(buildSkinCss("", {})).toBe("");
    expect(buildSkinCss("x", null)).toBe("");
  });

  it("emits an accent block scoped by data-community", () => {
    const css = buildSkinCss("rosario", {
      accents: { amber: "#e63946", red: "#d62828" },
    });
    expect(css).toContain(':root[data-community="rosario"] {');
    expect(css).toContain("--amber: #e63946;");
    expect(css).toContain("--red: #d62828;");
  });

  it("emits --on-amber from the onAmber accent (text on primary buttons)", () => {
    const css = buildSkinCss("rosario", {
      accents: { amber: "#ffd24a", onAmber: "#101010" },
    });
    expect(css).toContain("--on-amber: #101010;");
  });

  it("emits theme-scoped neutral blocks", () => {
    const css = buildSkinCss("rosario", {
      neutralsDark: { bgCard: "#1a0e12" },
      neutralsLight: { bgCard: "#fff0f2" },
    });
    expect(css).toContain(
      ':root[data-theme="dark"][data-community="rosario"] { --bg-card: #1a0e12; }',
    );
    expect(css).toContain(
      ':root[data-theme="light"][data-community="rosario"] { --bg-card: #fff0f2; }',
    );
  });

  it("drops non-color values (defense in depth)", () => {
    const css = buildSkinCss("x", {
      accents: { amber: "#fff", evil: "url(http://x)", bad: "red; }" },
    });
    expect(css).toContain("--amber: #fff;");
    expect(css).not.toContain("evil");
    expect(css).not.toContain("url(");
    expect(css).not.toContain("bad");
  });

  it("omits blocks with no valid tokens", () => {
    expect(buildSkinCss("x", { accents: {}, neutralsDark: {} })).toBe("");
  });
});
