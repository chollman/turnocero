import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSpeechInput } from "./useSpeechInput";

// Reconocimiento de voz falso: guarda la última instancia para disparar eventos.
let last;
class FakeRecognition {
  constructor() {
    last = this;
    this.start = vi.fn();
    this.stop = vi.fn(() => this.onend?.());
    this.abort = vi.fn();
  }
}

const results = (...parts) => ({
  results: parts.map((t) => [{ transcript: t }]),
});

afterEach(() => {
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
  last = undefined;
});

describe("useSpeechInput", () => {
  it("reports no support when the browser lacks speech recognition", () => {
    const { result } = renderHook(() => useSpeechInput());
    expect(result.current.supported).toBe(false);
    act(() => result.current.start());
    expect(result.current.listening).toBe(false);
  });

  it("uses the app language and accumulates the transcript", () => {
    window.webkitSpeechRecognition = FakeRecognition;
    const { result } = renderHook(() => useSpeechInput({ lang: "en" }));
    expect(result.current.supported).toBe(true);

    act(() => result.current.start());
    expect(last.lang).toBe("en-US");
    expect(last.start).toHaveBeenCalled();
    expect(result.current.listening).toBe(true);

    act(() => last.onresult(results("we played ", "Azul yesterday")));
    expect(result.current.transcript).toBe("we played Azul yesterday");

    act(() => result.current.stop());
    expect(result.current.listening).toBe(false);
    expect(result.current.transcript).toBe("we played Azul yesterday");
  });

  it("calls onEnd with the final text when listening stops", () => {
    window.SpeechRecognition = FakeRecognition;
    const onEnd = vi.fn();
    const { result } = renderHook(() => useSpeechInput({ onEnd }));
    act(() => result.current.start());
    act(() => last.onresult(results("ganó Juan")));
    act(() => last.onend());
    expect(onEnd).toHaveBeenCalledWith("ganó Juan");
  });

  it("defaults to Argentine Spanish", () => {
    window.SpeechRecognition = FakeRecognition;
    const { result } = renderHook(() => useSpeechInput());
    act(() => result.current.start());
    expect(last.lang).toBe("es-AR");
  });

  it("maps a denied microphone to a permission error", () => {
    window.SpeechRecognition = FakeRecognition;
    const { result } = renderHook(() => useSpeechInput());
    act(() => result.current.start());
    act(() => {
      last.onerror({ error: "not-allowed" });
      last.onend();
    });
    expect(result.current.error).toBe("permission");
    expect(result.current.listening).toBe(false);
  });

  it("ignores aborts and resets state", () => {
    window.SpeechRecognition = FakeRecognition;
    const { result } = renderHook(() => useSpeechInput());
    act(() => result.current.start());
    act(() => {
      last.onresult(results("hola"));
      last.onerror({ error: "aborted" });
    });
    expect(result.current.error).toBeNull();
    act(() => result.current.reset());
    expect(result.current.transcript).toBe("");
  });

  it("aborts the microphone on unmount", () => {
    window.SpeechRecognition = FakeRecognition;
    const { result, unmount } = renderHook(() => useSpeechInput());
    act(() => result.current.start());
    const rec = last;
    unmount();
    expect(rec.abort).toHaveBeenCalled();
  });
});
