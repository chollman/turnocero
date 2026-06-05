import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useSearchTerm from "./useSearchTerm";

describe("useSearchTerm", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function advance(ms) {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  it("devuelve '' mientras el término no alcanza minChars", () => {
    const { result, rerender } = renderHook(({ v }) => useSearchTerm(v), {
      initialProps: { v: "" },
    });
    expect(result.current).toBe("");

    rerender({ v: "ca" });
    advance(300);
    expect(result.current).toBe(""); // 2 chars < 3 → no busca
  });

  it("devuelve el término (trim) cuando alcanza minChars, tras el debounce", () => {
    const { result, rerender } = renderHook(({ v }) => useSearchTerm(v), {
      initialProps: { v: "" },
    });
    rerender({ v: "  catan  " });
    // Antes del debounce, sigue vacío.
    expect(result.current).toBe("");
    advance(300);
    expect(result.current).toBe("catan");
  });

  it("vuelve a '' al bajar de minChars", () => {
    const { result, rerender } = renderHook(({ v }) => useSearchTerm(v), {
      initialProps: { v: "catan" },
    });
    advance(300);
    expect(result.current).toBe("catan");
    rerender({ v: "ca" });
    advance(300);
    expect(result.current).toBe("");
  });

  it("respeta minChars custom", () => {
    const { result, rerender } = renderHook(
      ({ v }) => useSearchTerm(v, { minChars: 2 }),
      { initialProps: { v: "" } },
    );
    rerender({ v: "ca" });
    advance(300);
    expect(result.current).toBe("ca");
  });
});
