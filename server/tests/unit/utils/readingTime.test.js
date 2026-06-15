const { readingMinutes } = require("../../../utils/readingTime");

describe("readingMinutes", () => {
  it("returns at least 1 minute for empty/short text", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes(null)).toBe(1);
    expect(readingMinutes("Hola mundo")).toBe(1);
  });

  it("rounds ~200 words/min", () => {
    const words = Array(400).fill("palabra").join(" ");
    expect(readingMinutes(words)).toBe(2);
    const words600 = Array(600).fill("x").join(" ");
    expect(readingMinutes(words600)).toBe(3);
  });

  it("ignores extra whitespace", () => {
    expect(readingMinutes("  uno   dos    tres  ")).toBe(1);
  });
});
