import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useEventoSocket from './useEventoSocket';

const socketListeners = new Map();
let lastSocket = null;
let constructed = 0;
let emitted = [];

vi.mock('socket.io-client', () => ({
  io: () => {
    socketListeners.clear();
    constructed += 1;
    const s = {
      on: (event, fn) => {
        socketListeners.set(event, fn);
      },
      off: () => {},
      emit: (event, ...args) => {
        emitted.push([event, ...args]);
      },
      disconnect: vi.fn(),
    };
    lastSocket = s;
    return s;
  },
}));

function triggerSocket(event, payload) {
  const fn = socketListeners.get(event);
  if (!fn) throw new Error(`No listener for ${event}`);
  act(() => fn(payload));
}

beforeEach(() => {
  socketListeners.clear();
  constructed = 0;
  emitted = [];
  localStorage.setItem('token', 'fake-token');
});

afterEach(() => {
  localStorage.removeItem('token');
});

describe('useEventoSocket', () => {
  it('no abre socket si no hay token', () => {
    localStorage.removeItem('token');
    renderHook(() => useEventoSocket('e1', { onCountsChanged: vi.fn() }));
    expect(constructed).toBe(0);
  });

  it('no abre socket si id es falsy', () => {
    renderHook(() => useEventoSocket(null, { onCountsChanged: vi.fn() }));
    expect(constructed).toBe(0);
  });

  it('emite join:evento al conectar', () => {
    renderHook(() => useEventoSocket('e1'));
    // Simulamos el connect callback que el server emitiría tras handshake
    act(() => socketListeners.get('connect')?.());
    expect(emitted).toContainEqual(['join:evento', 'e1']);
  });

  it('llama onCountsChanged cuando el server emite evento:counts-changed con id matching', () => {
    const onCountsChanged = vi.fn();
    renderHook(() => useEventoSocket('e1', { onCountsChanged }));
    triggerSocket('evento:counts-changed', { eventoId: 'e1', counts: { total: 1 } });
    expect(onCountsChanged).toHaveBeenCalledWith({
      eventoId: 'e1',
      counts: { total: 1 },
    });
  });

  it('ignora payloads con eventoId que no matchea (no llama callback)', () => {
    const onCountsChanged = vi.fn();
    renderHook(() => useEventoSocket('e1', { onCountsChanged }));
    triggerSocket('evento:counts-changed', { eventoId: 'OTHER', counts: {} });
    expect(onCountsChanged).not.toHaveBeenCalled();
  });

  it('callbacks se actualizan sin reconectar el socket', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const { rerender } = renderHook(
      ({ cb }) => useEventoSocket('e1', { onCountsChanged: cb }),
      { initialProps: { cb: cb1 } },
    );
    expect(constructed).toBe(1);
    rerender({ cb: cb2 });
    // No se creó otro socket — solo el ref se actualizó.
    expect(constructed).toBe(1);
    triggerSocket('evento:counts-changed', { eventoId: 'e1' });
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
  });

  it('reconecta cuando cambia el id (cleanup + nuevo socket)', () => {
    const { rerender } = renderHook(
      ({ id }) => useEventoSocket(id, {}),
      { initialProps: { id: 'e1' } },
    );
    expect(constructed).toBe(1);
    const firstDisconnect = lastSocket.disconnect;
    rerender({ id: 'e2' });
    expect(firstDisconnect).toHaveBeenCalled();
    expect(constructed).toBe(2);
  });

  it('llama onReviewed y onUpdated también', () => {
    const onReviewed = vi.fn();
    const onUpdated = vi.fn();
    renderHook(() => useEventoSocket('e1', { onReviewed, onUpdated }));
    triggerSocket('evento:registration-reviewed', { eventoId: 'e1', userId: 'u1' });
    triggerSocket('evento:updated', { eventoId: 'e1', evento: { title: 'x' } });
    expect(onReviewed).toHaveBeenCalledWith({ eventoId: 'e1', userId: 'u1' });
    expect(onUpdated).toHaveBeenCalledWith({ eventoId: 'e1', evento: { title: 'x' } });
  });

  it('emite leave:evento + disconnect en unmount', () => {
    const { unmount } = renderHook(() => useEventoSocket('e1'));
    const disconnect = lastSocket.disconnect;
    unmount();
    expect(emitted).toContainEqual(['leave:evento', 'e1']);
    expect(disconnect).toHaveBeenCalled();
  });
});
