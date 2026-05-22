const { escapeRegex } = require("../../../utils/regex");

describe("escapeRegex", () => {
  it("deja strings sin metacaracteres tal cual", () => {
    expect(escapeRegex("hola")).toBe("hola");
    expect(escapeRegex("Catan")).toBe("Catan");
  });

  it("escapa los metacaracteres regex", () => {
    expect(escapeRegex(".")).toBe("\\.");
    expect(escapeRegex("*")).toBe("\\*");
    expect(escapeRegex("+")).toBe("\\+");
    expect(escapeRegex("?")).toBe("\\?");
    expect(escapeRegex("^")).toBe("\\^");
    expect(escapeRegex("$")).toBe("\\$");
    expect(escapeRegex("{")).toBe("\\{");
    expect(escapeRegex("}")).toBe("\\}");
    expect(escapeRegex("(")).toBe("\\(");
    expect(escapeRegex(")")).toBe("\\)");
    expect(escapeRegex("|")).toBe("\\|");
    expect(escapeRegex("[")).toBe("\\[");
    expect(escapeRegex("]")).toBe("\\]");
    expect(escapeRegex("\\")).toBe("\\\\");
  });

  it("hace que el output sea seguro para usar en new RegExp(...)", () => {
    const input = ".*"; // sin escape matchearía cualquier cosa
    const re = new RegExp(escapeRegex(input));
    expect(re.test("any string")).toBe(false);
    expect(re.test(".*")).toBe(true);
  });

  it("preserva caracteres internacionales (UTF-8)", () => {
    expect(escapeRegex("á é í ó ú ñ")).toBe("á é í ó ú ñ");
    expect(escapeRegex("中文")).toBe("中文");
  });

  it("retorna string vacío para valores no-string sin tirar", () => {
    expect(escapeRegex(null)).toBe("");
    expect(escapeRegex(undefined)).toBe("");
    expect(escapeRegex(42)).toBe("");
    expect(escapeRegex({})).toBe("");
  });

  it("permite buscar substring que contiene metacaracteres", () => {
    const userQuery = "hello (world)";
    const re = new RegExp(escapeRegex(userQuery), "i");
    expect(re.test("Hello (world) goodbye")).toBe(true);
  });
});
