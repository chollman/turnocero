import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import {
  getShortPath,
  getShortUrl,
  __resetShortLinkCache,
} from "./shortlink";

vi.mock("axios", () => ({ default: { post: vi.fn() } }));

beforeEach(() => {
  __resetShortLinkCache();
  axios.post.mockReset();
});

describe("getShortPath", () => {
  it("returns /s/<code> on success", async () => {
    axios.post.mockResolvedValue({ data: { code: "Ab3xK9" } });
    const path = await getShortPath({ type: "compartida", ref: "abc" });
    expect(path).toBe("/s/Ab3xK9");
    expect(axios.post).toHaveBeenCalledWith("/api/shortlinks", {
      type: "compartida",
      ref: "abc",
    });
  });

  it("caches + deduplicates: same resource hits the server once", async () => {
    axios.post.mockResolvedValue({ data: { code: "Ab3xK9" } });
    const [a, b] = await Promise.all([
      getShortPath({ type: "compartida", ref: "abc" }),
      getShortPath({ type: "compartida", ref: "abc" }),
    ]);
    expect(a).toBe("/s/Ab3xK9");
    expect(b).toBe("/s/Ab3xK9");
    // Tercera llamada (post-resolución) sigue cacheada.
    await getShortPath({ type: "compartida", ref: "abc" });
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it("returns null on error and does NOT cache the failure (retries next time)", async () => {
    axios.post.mockRejectedValueOnce(new Error("boom"));
    expect(await getShortPath({ type: "evento", ref: "e1" })).toBeNull();

    axios.post.mockResolvedValueOnce({ data: { code: "Zz9" } });
    expect(await getShortPath({ type: "evento", ref: "e1" })).toBe("/s/Zz9");
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it("returns null without hitting the server when type/ref missing", async () => {
    expect(await getShortPath({ type: "", ref: "x" })).toBeNull();
    expect(await getShortPath({ type: "compartida", ref: "" })).toBeNull();
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe("getShortUrl", () => {
  it("prefixes the origin to the short path", async () => {
    axios.post.mockResolvedValue({ data: { code: "Ab3xK9" } });
    const url = await getShortUrl({
      type: "compartida",
      ref: "abc",
      origin: "https://turnocero.app",
    });
    expect(url).toBe("https://turnocero.app/s/Ab3xK9");
  });

  it("returns null when resolution fails", async () => {
    axios.post.mockRejectedValue(new Error("boom"));
    const url = await getShortUrl({
      type: "compartida",
      ref: "abc",
      origin: "https://turnocero.app",
    });
    expect(url).toBeNull();
  });
});
