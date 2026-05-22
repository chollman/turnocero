import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useApi } from "./useApi";

describe("useApi", () => {
  it("inicia con loading=false, error vacío, data=null", () => {
    const { result } = renderHook(() => useApi(async () => "ok"));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("");
    expect(result.current.data).toBeNull();
  });

  it("flippea loading=true mientras la promesa vuela y false al resolver", async () => {
    let resolveFn;
    const fn = vi.fn(
      () => new Promise((resolve) => { resolveFn = resolve; }),
    );
    const { result } = renderHook(() => useApi(fn));

    let promise;
    act(() => {
      promise = result.current.execute();
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveFn("data!");
      await promise;
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe("data!");
    expect(result.current.error).toBe("");
  });

  it("setea error con getErrorMessage y RE-TIRA el error original", async () => {
    const err = { response: { data: { message: "boom" } } };
    const fn = vi.fn(() => Promise.reject(err));
    const { result } = renderHook(() => useApi(fn));

    let thrown;
    await act(async () => {
      try {
        await result.current.execute();
      } catch (e) {
        thrown = e;
      }
    });

    expect(thrown).toBe(err);
    expect(result.current.error).toBe("boom");
    expect(result.current.loading).toBe(false);
  });

  it("usa defaultErrorMessage si el err no trae mensaje legible", async () => {
    const fn = vi.fn(() => Promise.reject({}));
    const { result } = renderHook(() =>
      useApi(fn, { defaultErrorMessage: "fallback" }),
    );

    await act(async () => {
      try { await result.current.execute(); } catch { /* expected */ }
    });
    expect(result.current.error).toBe("fallback");
  });

  it("pasa argumentos a fn y devuelve el resultado", async () => {
    const fn = vi.fn(async (a, b) => a + b);
    const { result } = renderHook(() => useApi(fn));

    let returned;
    await act(async () => {
      returned = await result.current.execute(2, 3);
    });
    expect(fn).toHaveBeenCalledWith(2, 3);
    expect(returned).toBe(5);
    expect(result.current.data).toBe(5);
  });

  it("reset limpia loading/error/data", async () => {
    const fn = vi.fn(async () => "x");
    const { result } = renderHook(() => useApi(fn));

    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.data).toBe("x");

    act(() => result.current.reset());
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("");
    expect(result.current.loading).toBe(false);
  });

  it("un execute con éxito después de uno fallido limpia el error", async () => {
    let shouldFail = true;
    const fn = vi.fn(async () => {
      if (shouldFail) throw new Error("fail1");
      return "ok";
    });
    const { result } = renderHook(() => useApi(fn));

    await act(async () => {
      try { await result.current.execute(); } catch { /* expected */ }
    });
    expect(result.current.error).toBe("fail1");

    shouldFail = false;
    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.error).toBe("");
    expect(result.current.data).toBe("ok");
  });

  it("ignora setStates si el componente desmonta antes de resolver", async () => {
    let resolveFn;
    const fn = vi.fn(
      () => new Promise((resolve) => { resolveFn = resolve; }),
    );
    const { result, unmount } = renderHook(() => useApi(fn));

    let promise;
    act(() => {
      promise = result.current.execute();
    });
    expect(result.current.loading).toBe(true);

    unmount();

    // Resolver post-unmount no debería tirar warning ni cambiar state.
    await act(async () => {
      resolveFn("late");
      await promise;
    });
    // result.current refleja el último render previo al unmount.
    expect(result.current.loading).toBe(true);
  });
});
