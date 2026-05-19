import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import useVisualViewportVars from './useVisualViewportVars';

function makeViewport({ offsetTop = 0, offsetLeft = 0, width = 360, height = 640, scale = 1 } = {}) {
  const listeners = {};
  return {
    offsetTop,
    offsetLeft,
    width,
    height,
    scale,
    addEventListener: (event, cb) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    },
    removeEventListener: (event, cb) => {
      listeners[event] = (listeners[event] || []).filter(fn => fn !== cb);
    },
    fire(event) {
      (listeners[event] || []).forEach(cb => cb());
    },
  };
}

describe('useVisualViewportVars', () => {
  const originalVV = window.visualViewport;
  let root;

  beforeEach(() => {
    root = document.documentElement;
    Object.defineProperty(root, 'clientHeight', { value: 800, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', {
      value: originalVV,
      configurable: true,
      writable: true,
    });
    root.style.removeProperty('--vv-top');
    root.style.removeProperty('--vv-left');
    root.style.removeProperty('--vv-width');
    root.style.removeProperty('--vv-bottom');
    root.style.removeProperty('--vv-scale');
  });

  it('sets baseline vars when not zoomed', () => {
    const vv = makeViewport({ width: 360, height: 800 });
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true, writable: true });

    renderHook(() => useVisualViewportVars());

    expect(root.style.getPropertyValue('--vv-top')).toBe('0px');
    expect(root.style.getPropertyValue('--vv-left')).toBe('0px');
    expect(root.style.getPropertyValue('--vv-width')).toBe('360px');
    expect(root.style.getPropertyValue('--vv-bottom')).toBe('0px');
    expect(root.style.getPropertyValue('--vv-scale')).toBe('1');
  });

  it('updates vars to reflect zoom offset, scale, and visible bottom margin', () => {
    const vv = makeViewport({ offsetTop: 50, offsetLeft: 30, width: 180, height: 400, scale: 2 });
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true, writable: true });

    renderHook(() => useVisualViewportVars());

    expect(root.style.getPropertyValue('--vv-top')).toBe('50px');
    expect(root.style.getPropertyValue('--vv-left')).toBe('30px');
    expect(root.style.getPropertyValue('--vv-width')).toBe('180px');
    // layoutHeight (800) - offsetTop (50) - height (400) = 350
    expect(root.style.getPropertyValue('--vv-bottom')).toBe('350px');
    expect(root.style.getPropertyValue('--vv-scale')).toBe('2');
  });

  it('reacts to visualViewport scroll/resize events', () => {
    const vv = makeViewport({ width: 360, height: 800 });
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true, writable: true });

    renderHook(() => useVisualViewportVars());

    vv.offsetTop = 80;
    vv.height = 500;
    vv.fire('scroll');

    expect(root.style.getPropertyValue('--vv-top')).toBe('80px');
    expect(root.style.getPropertyValue('--vv-bottom')).toBe('220px');
  });

  it('removes its listeners on unmount', () => {
    const vv = makeViewport();
    const removeSpy = vi.spyOn(vv, 'removeEventListener');
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true, writable: true });

    const { unmount } = renderHook(() => useVisualViewportVars());
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('no-ops when visualViewport is unavailable', () => {
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true, writable: true });

    expect(() => renderHook(() => useVisualViewportVars())).not.toThrow();
    expect(root.style.getPropertyValue('--vv-top')).toBe('');
  });
});
