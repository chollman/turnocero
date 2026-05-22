import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import axios from "axios";
import { useCompartidaLike } from "./useCompartidaLike";

vi.mock("axios");

const user = { _id: "u1", username: "tester" };
const otherUser = { _id: "u2", username: "amigo" };

function makePost(overrides = {}) {
  return {
    _id: "p1",
    likes: [],
    ...overrides,
  };
}

describe("useCompartidaLike", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("inicia con liked=false y count=0 cuando no hay likes", () => {
    const { result } = renderHook(() =>
      useCompartidaLike({ post: makePost(), user }),
    );
    expect(result.current.liked).toBe(false);
    expect(result.current.count).toBe(0);
    expect(result.current.popping).toBe(false);
  });

  it("detecta si el user ya likeó (formato populated)", () => {
    const post = makePost({ likes: [{ _id: "u1" }, { _id: "u2" }] });
    const { result } = renderHook(() => useCompartidaLike({ post, user }));
    expect(result.current.liked).toBe(true);
    expect(result.current.count).toBe(2);
  });

  it("detecta si el user ya likeó (formato string ObjectId)", () => {
    const post = makePost({ likes: ["u1", "u9"] });
    const { result } = renderHook(() => useCompartidaLike({ post, user }));
    expect(result.current.liked).toBe(true);
  });

  it("toggle hace optimistic update + POST + setea popping al likear", async () => {
    axios.post.mockResolvedValue({});
    const { result } = renderHook(() =>
      useCompartidaLike({ post: makePost(), user }),
    );

    await act(async () => {
      await result.current.toggle();
    });

    expect(result.current.liked).toBe(true);
    expect(result.current.count).toBe(1);
    expect(result.current.popping).toBe(true);
    expect(axios.post).toHaveBeenCalledWith("/api/compartidas/p1/like");

    act(() => vi.advanceTimersByTime(350));
    expect(result.current.popping).toBe(false);
  });

  it("toggle de likeado a no-likeado decrementa y no setea popping", async () => {
    axios.post.mockResolvedValue({});
    const post = makePost({ likes: [{ _id: "u1" }] });
    const { result } = renderHook(() => useCompartidaLike({ post, user }));

    await act(async () => {
      await result.current.toggle();
    });

    expect(result.current.liked).toBe(false);
    expect(result.current.count).toBe(0);
    expect(result.current.popping).toBe(false);
  });

  it("rollback si el POST falla", async () => {
    axios.post.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() =>
      useCompartidaLike({ post: makePost(), user }),
    );

    await act(async () => {
      await result.current.toggle();
    });

    expect(result.current.liked).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it("sin user, toggle devuelve { requiresLogin: true } sin POST", async () => {
    const { result } = renderHook(() =>
      useCompartidaLike({ post: makePost(), user: null }),
    );
    expect(result.current.requiresLogin).toBe(true);
    let outcome;
    await act(async () => {
      outcome = await result.current.toggle();
    });
    expect(outcome).toEqual({ requiresLogin: true });
    expect(axios.post).not.toHaveBeenCalled();
    expect(result.current.liked).toBe(false);
  });

  it("toggles consecutivos no se solapan en el timer de pop", async () => {
    axios.post.mockResolvedValue({});
    const { result } = renderHook(() =>
      useCompartidaLike({ post: makePost(), user }),
    );

    await act(async () => {
      await result.current.toggle();
    });
    expect(result.current.popping).toBe(true);

    // Tirar otro toggle (unlike) — el timer del anterior NO debe seguir
    // cambiando popping después de que el unlike lo apagó.
    await act(async () => {
      await result.current.toggle();
    });
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.popping).toBe(false);
  });

  it("count refleja correctamente cuando otros usuarios ya likearon", () => {
    const post = makePost({ likes: [{ _id: "u2" }, { _id: "u3" }] });
    const { result } = renderHook(() => useCompartidaLike({ post, user }));
    expect(result.current.liked).toBe(false);
    expect(result.current.count).toBe(2);
    void otherUser; // referenced for clarity
  });
});
