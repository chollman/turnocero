import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useLocalStorageState from './useLocalStorageState';

const KEY = 'test-key-evento-view';

describe('useLocalStorageState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns the default value when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorageState(KEY, 'timeline'));
    expect(result.current[0]).toBe('timeline');
  });

  it('reads the stored value on mount', () => {
    window.localStorage.setItem(KEY, JSON.stringify('poster'));
    const { result } = renderHook(() => useLocalStorageState(KEY, 'timeline'));
    expect(result.current[0]).toBe('poster');
  });

  it('writes the new value to localStorage on set', () => {
    const { result } = renderHook(() => useLocalStorageState(KEY, 'timeline'));

    act(() => result.current[1]('poster'));

    expect(result.current[0]).toBe('poster');
    expect(JSON.parse(window.localStorage.getItem(KEY))).toBe('poster');
  });

  it('supports functional updates', () => {
    const { result } = renderHook(() => useLocalStorageState(KEY, 0));

    act(() => result.current[1](v => v + 1));
    act(() => result.current[1](v => v + 1));

    expect(result.current[0]).toBe(2);
    expect(JSON.parse(window.localStorage.getItem(KEY))).toBe(2);
  });

  it('handles JSON serialization round-trip for objects', () => {
    const { result } = renderHook(() => useLocalStorageState(KEY, { a: 1 }));

    act(() => result.current[1]({ a: 2, b: 'x' }));

    expect(result.current[0]).toEqual({ a: 2, b: 'x' });
    expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual({ a: 2, b: 'x' });
  });

  it('falls back to default on malformed JSON', () => {
    window.localStorage.setItem(KEY, '{not valid json');
    const { result } = renderHook(() => useLocalStorageState(KEY, 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('does not throw when localStorage is unavailable', () => {
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', { value: undefined, configurable: true, writable: true });
    try {
      const { result } = renderHook(() => useLocalStorageState(KEY, 'safe'));
      expect(result.current[0]).toBe('safe');
      expect(() => act(() => result.current[1]('changed'))).not.toThrow();
    } finally {
      Object.defineProperty(window, 'localStorage', { value: original, configurable: true, writable: true });
    }
  });

  it('swallows write errors (quota exceeded)', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => useLocalStorageState(KEY, 'a'));
    expect(() => act(() => result.current[1]('b'))).not.toThrow();
    expect(result.current[0]).toBe('b');

    setItemSpy.mockRestore();
  });
});
