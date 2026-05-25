import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useDebouncedValue from "./useDebouncedValue";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("returns the initial value synchronously on first render", () => {
    const { result } = renderHook(() => useDebouncedValue("hola", 300));
    expect(result.current).toBe("hola");
  });

  it("does not update the debounced value before delayMs", () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebouncedValue(v, 300),
      {
        initialProps: { v: "a" },
      },
    );
    rerender({ v: "ab" });
    act(() => vi.advanceTimersByTime(150));
    expect(result.current).toBe("a");
  });

  it("updates the debounced value after delayMs of stable input", () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebouncedValue(v, 300),
      {
        initialProps: { v: "a" },
      },
    );
    rerender({ v: "hola" });
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe("hola");
  });

  it("only emits the last value when input changes faster than delayMs", () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebouncedValue(v, 300),
      {
        initialProps: { v: "" },
      },
    );
    rerender({ v: "h" });
    act(() => vi.advanceTimersByTime(100));
    rerender({ v: "ho" });
    act(() => vi.advanceTimersByTime(100));
    rerender({ v: "hol" });
    act(() => vi.advanceTimersByTime(100));
    rerender({ v: "hola" });
    // En ningún momento avanzamos los 300ms enteros sin un cambio → seguimos con el valor inicial.
    expect(result.current).toBe("");
    // Ahora dejamos pasar el tiempo completo sin más cambios → debe emitir 'hola'.
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe("hola");
  });

  it("respects a custom delayMs", () => {
    const { result, rerender } = renderHook(
      ({ v, d }) => useDebouncedValue(v, d),
      {
        initialProps: { v: "a", d: 500 },
      },
    );
    rerender({ v: "b", d: 500 });
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("b");
  });

  it("works with non-string values (numbers, objects)", () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebouncedValue(v, 100),
      {
        initialProps: { v: 0 },
      },
    );
    rerender({ v: 42 });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe(42);

    const obj = { x: 1 };
    rerender({ v: obj });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe(obj);
  });

  it("clears the pending timer when unmounted (no late updates)", () => {
    const { result, rerender, unmount } = renderHook(
      ({ v }) => useDebouncedValue(v, 300),
      {
        initialProps: { v: "a" },
      },
    );
    rerender({ v: "b" });
    unmount();
    // Si el cleanup no funcionara, este advance dispararía un setDebounced post-unmount.
    // El test pasa simplemente con que no haya warnings/errors al avanzar.
    act(() => vi.advanceTimersByTime(500));
    // result.current sigue siendo el último valor capturado pre-unmount.
    expect(result.current).toBe("a");
  });
});
