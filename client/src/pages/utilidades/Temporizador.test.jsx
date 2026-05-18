import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Temporizador from './Temporizador';

function renderTimer() {
  return render(
    <MemoryRouter>
      <Temporizador />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom doesn't implement AudioContext; the component already try/catches.
});
afterEach(() => {
  vi.useRealTimers();
});

describe('<Temporizador>', () => {
  it('starts at 3 minutes by default', () => {
    renderTimer();
    expect(screen.getByText('03:00')).toBeInTheDocument();
  });

  it('selecting a preset updates the displayed time', () => {
    renderTimer();
    fireEvent.click(screen.getByRole('button', { name: '5m' }));
    expect(screen.getByText('05:00')).toBeInTheDocument();
  });

  it('clicking Iniciar ticks down each second', () => {
    renderTimer();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('02:57')).toBeInTheDocument();
  });

  it('Pausar stops ticking; Continuar resumes', () => {
    renderTimer();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText('02:55')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText('02:55')).toBeInTheDocument(); // unchanged while paused

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByText('02:53')).toBeInTheDocument();
  });

  it('Reiniciar (during running) returns to the original preset time', () => {
    renderTimer();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }));
    act(() => { vi.advanceTimersByTime(30000); });
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar' }));
    expect(screen.getByText('03:00')).toBeInTheDocument();
  });

  it('shows "¡Tiempo!" when the timer reaches zero', () => {
    renderTimer();
    fireEvent.click(screen.getByRole('button', { name: '1m' }));
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }));
    act(() => { vi.advanceTimersByTime(61000); });
    expect(screen.getByText(/tiempo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /de nuevo/i })).toBeInTheDocument();
  });
});
