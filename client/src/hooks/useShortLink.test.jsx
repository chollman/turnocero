import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useShortLink } from "./useShortLink";
import { getShortUrl } from "../utils/shortlink";

vi.mock("../utils/shortlink", () => ({ getShortUrl: vi.fn() }));

beforeEach(() => getShortUrl.mockReset());

describe("useShortLink", () => {
  it("is lazy: does not resolve until prime() is called", () => {
    getShortUrl.mockResolvedValue("https://x/s/abc");
    const { result } = renderHook(() =>
      useShortLink({ type: "compartida", ref: "1" }),
    );
    expect(getShortUrl).not.toHaveBeenCalled();
    expect(result.current.shortUrl).toBeNull();
  });

  it("resolves on mount when eager", async () => {
    getShortUrl.mockResolvedValue("https://x/s/abc");
    const { result } = renderHook(() =>
      useShortLink({ type: "compartida", ref: "1", eager: true }),
    );
    await waitFor(() =>
      expect(result.current.shortUrl).toBe("https://x/s/abc"),
    );
    expect(getShortUrl).toHaveBeenCalledTimes(1);
  });

  it("prime() resolves once (idempotent) and sets shortUrl", async () => {
    getShortUrl.mockResolvedValue("https://x/s/abc");
    const { result } = renderHook(() =>
      useShortLink({ type: "compartida", ref: "1" }),
    );
    act(() => {
      result.current.prime();
      result.current.prime();
    });
    await waitFor(() =>
      expect(result.current.shortUrl).toBe("https://x/s/abc"),
    );
    expect(getShortUrl).toHaveBeenCalledTimes(1);
  });

  it("keeps shortUrl null when resolution returns null", async () => {
    getShortUrl.mockResolvedValue(null);
    const { result } = renderHook(() =>
      useShortLink({ type: "compartida", ref: "1", eager: true }),
    );
    await act(async () => {});
    expect(result.current.shortUrl).toBeNull();
  });
});
