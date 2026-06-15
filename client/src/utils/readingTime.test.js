import { describe, it, expect } from "vitest";
import { readingMinutes, readingLabel } from "./readingTime";

describe("readingMinutes", () => {
  it("returns at least 1 for empty/short input", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes(null)).toBe(1);
    expect(readingMinutes("Hola mundo")).toBe(1);
  });

  it("strips HTML tags before counting", () => {
    const html = `<p>${Array(400).fill("palabra").join(" ")}</p>`;
    expect(readingMinutes(html)).toBe(2);
  });

  it("readingLabel formats the minutes", () => {
    expect(readingLabel("una dos tres")).toBe("lectura 1 min");
  });
});
