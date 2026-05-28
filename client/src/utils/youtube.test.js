import { describe, it, expect } from "vitest";
import {
  parseYouTubeVideoId,
  youtubeWatchUrl,
  YOUTUBE_VIDEO_ID_REGEX,
} from "./youtube";

describe("YOUTUBE_VIDEO_ID_REGEX", () => {
  it("acepta IDs válidos de 11 chars", () => {
    expect(YOUTUBE_VIDEO_ID_REGEX.test("dQw4w9WgXcQ")).toBe(true);
    expect(YOUTUBE_VIDEO_ID_REGEX.test("9bZkp7q19f0")).toBe(true);
    expect(YOUTUBE_VIDEO_ID_REGEX.test("___-aA1bC2_")).toBe(true);
  });

  it("rechaza IDs de longitud incorrecta o caracteres inválidos", () => {
    expect(YOUTUBE_VIDEO_ID_REGEX.test("short")).toBe(false);
    expect(YOUTUBE_VIDEO_ID_REGEX.test("toolongtoolong")).toBe(false);
    expect(YOUTUBE_VIDEO_ID_REGEX.test("dQw4w9WgX!Q")).toBe(false); // signo de exclamación
  });
});

describe("parseYouTubeVideoId", () => {
  it("acepta ID puro", () => {
    expect(parseYouTubeVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extrae de youtube.com/watch?v=", () => {
    expect(
      parseYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeVideoId("http://youtube.com/watch?v=9bZkp7q19f0")).toBe(
      "9bZkp7q19f0",
    );
  });

  it("ignora query params extra después del v=", () => {
    expect(
      parseYouTubeVideoId(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s&feature=share",
      ),
    ).toBe("dQw4w9WgXcQ");
  });

  it("acepta v= no primer param", () => {
    expect(
      parseYouTubeVideoId(
        "https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
      ),
    ).toBe("dQw4w9WgXcQ");
  });

  it("extrae de youtu.be/", () => {
    expect(parseYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(parseYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?si=abc123")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("extrae de /embed/", () => {
    expect(
      parseYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("extrae de /shorts/", () => {
    expect(
      parseYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
    expect(
      parseYouTubeVideoId("https://youtube.com/shorts/dQw4w9WgXcQ?feature=x"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("trimea whitespace", () => {
    expect(
      parseYouTubeVideoId("   https://youtu.be/dQw4w9WgXcQ   "),
    ).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeVideoId("\n\tdQw4w9WgXcQ  ")).toBe("dQw4w9WgXcQ");
  });

  it("devuelve null para URLs sin video válido", () => {
    expect(parseYouTubeVideoId("https://www.youtube.com")).toBeNull();
    expect(
      parseYouTubeVideoId("https://www.youtube.com/watch?v=short"),
    ).toBeNull();
    expect(parseYouTubeVideoId("https://youtu.be/short")).toBeNull();
    expect(parseYouTubeVideoId("https://vimeo.com/12345")).toBeNull();
  });

  it("devuelve null para inputs vacíos / no-string", () => {
    expect(parseYouTubeVideoId("")).toBeNull();
    expect(parseYouTubeVideoId("   ")).toBeNull();
    expect(parseYouTubeVideoId(null)).toBeNull();
    expect(parseYouTubeVideoId(undefined)).toBeNull();
    expect(parseYouTubeVideoId(123)).toBeNull();
  });

  it("devuelve null si el ID extraído del URL no es de 11 chars", () => {
    expect(
      parseYouTubeVideoId("https://www.youtube.com/watch?v=tooShort"),
    ).toBeNull();
  });
});

describe("youtubeWatchUrl", () => {
  it("construye URL canónico", () => {
    expect(youtubeWatchUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });

  it("encodea caracteres especiales (defensivo, los IDs reales no los tienen)", () => {
    expect(youtubeWatchUrl("a?b&c")).toBe(
      "https://www.youtube.com/watch?v=a%3Fb%26c",
    );
  });
});
