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
    act(() => result.current.stop());
    expect(onEnd).toHaveBeenCalledWith("ganó Juan");
  });

  it("listens continuously so short pauses don't end the take", () => {
    window.SpeechRecognition = FakeRecognition;
    const { result } = renderHook(() => useSpeechInput());
    act(() => result.current.start());
    expect(last.continuous).toBe(true);
  });

  it("stops by itself only after the silence window", () => {
    vi.useFakeTimers();
    try {
      window.SpeechRecognition = FakeRecognition;
      const onEnd = vi.fn();
      const { result } = renderHook(() =>
        useSpeechInput({ onEnd, silenceMs: 5000 }),
      );
      act(() => result.current.start());
      act(() => last.onresult(results("jugamos Root")));
      act(() => vi.advanceTimersByTime(4000));
      expect(result.current.listening).toBe(true);
      // Hablar de nuevo reinicia la ventana de silencio.
      act(() => last.onresult(results("jugamos Root con Juan")));
      act(() => vi.advanceTimersByTime(4000));
      expect(result.current.listening).toBe(true);
      act(() => vi.advanceTimersByTime(1000));
      expect(result.current.listening).toBe(false);
      expect(onEnd).toHaveBeenCalledWith("jugamos Root con Juan");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reopens the microphone when the browser ends early and keeps the text", () => {
    window.SpeechRecognition = FakeRecognition;
    const onEnd = vi.fn();
    const { result } = renderHook(() => useSpeechInput({ onEnd }));
    act(() => result.current.start());
    const first = last;
    act(() => first.onresult(results("ayer jugamos Azul")));
    act(() => first.onend());
    expect(last).not.toBe(first);
    expect(last.start).toHaveBeenCalled();
    expect(result.current.listening).toBe(true);
    expect(onEnd).not.toHaveBeenCalled();

    act(() => last.onresult(results("ganó Meli")));
    expect(result.current.transcript).toBe("ayer jugamos Azul ganó Meli");
    act(() => result.current.stop());
    expect(onEnd).toHaveBeenCalledWith("ayer jugamos Azul ganó Meli");
  });

  it("caps the total length of a take", () => {
    vi.useFakeTimers();
    try {
      window.SpeechRecognition = FakeRecognition;
      const { result } = renderHook(() =>
        useSpeechInput({ silenceMs: 5000, maxMs: 12000 }),
      );
      act(() => result.current.start());
      for (let i = 0; i < 3; i++) {
        act(() => last.onresult(results(`parte ${i}`)));
        act(() => vi.advanceTimersByTime(4000));
      }
      expect(result.current.listening).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives up after repeated early ends with no speech", () => {
    window.SpeechRecognition = FakeRecognition;
    const { result } = renderHook(() => useSpeechInput());
    act(() => result.current.start());
    for (let i = 0; i < 10 && result.current.listening; i++) {
      act(() => last.onend());
    }
    expect(result.current.listening).toBe(false);
    expect(result.current.error).toBe("no-speech");
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
    // Un error grave no reabre el micrófono.
    expect(last.start).toHaveBeenCalledTimes(1);
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
