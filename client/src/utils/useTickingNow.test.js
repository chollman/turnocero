import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTickingNow from './useTickingNow';

describe('useTickingNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the current timestamp on initial render', () => {
    const start = 1_700_000_000_000;
    vi.setSystemTime(start);
    const { result } = renderHook(() => useTickingNow());
    expect(result.current).toBe(start);
  });

  it('updates every intervalMs (default 30s)', () => {
    const start = 1_700_000_000_000;
    vi.setSystemTime(start);
    const { result } = renderHook(() => useTickingNow());
    expect(result.current).toBe(start);

    // vi.advanceTimersByTime con fake timers avanza Date.now() también, así
    // que no hace falta setSystemTime extra (eso double-avanzaría el reloj).
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current).toBe(start + 30_000);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current).toBe(start + 60_000);
  });

  it('respects a custom interval', () => {
    const start = 1_700_000_000_000;
    vi.setSystemTime(start);
    const { result } = renderHook(() => useTickingNow(5_000));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current).toBe(start + 5_000);
  });

  it('clears the interval on unmount (no leak)', () => {
    const clearSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = renderHook(() => useTickingNow());
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
