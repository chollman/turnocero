import { describe, it, expect } from "vitest";
import { extractYoutubeId } from "./noticiaEditorExtensions";

describe("extractYoutubeId", () => {
  it("parses watch URLs", () => {
    expect(
      extractYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("parses youtu.be short URLs", () => {
    expect(extractYoutubeId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("parses embed and shorts URLs", () => {
    expect(extractYoutubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(extractYoutubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("accepts a bare id", () => {
    expect(extractYoutubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for non-YouTube input", () => {
    expect(extractYoutubeId("https://vimeo.com/123")).toBeNull();
    expect(extractYoutubeId("")).toBeNull();
    expect(extractYoutubeId(null)).toBeNull();
  });
});
