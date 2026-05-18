import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeContext';

const THEME_KEY = 'turnocero_theme';

function Probe() {
  const { theme, setTheme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setTheme('light')}>set-light</button>
      <button onClick={() => setTheme('dark')}>set-dark</button>
      <button onClick={() => setTheme('invalid')}>set-invalid</button>
      <button onClick={toggleTheme}>toggle</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.removeItem(THEME_KEY);
  document.documentElement.removeAttribute('data-theme');
});

describe('ThemeContext', () => {
  it('defaults to "dark" when localStorage has no preference', () => {
    renderProbe();
    expect(screen.getByTestId('theme').textContent).toBe('dark');
  });

  it('reads the saved theme from localStorage on mount', () => {
    localStorage.setItem(THEME_KEY, 'light');
    renderProbe();
    expect(screen.getByTestId('theme').textContent).toBe('light');
  });

  it('ignores invalid stored values and falls back to "dark"', () => {
    localStorage.setItem(THEME_KEY, 'rainbow');
    renderProbe();
    expect(screen.getByTestId('theme').textContent).toBe('dark');
  });

  it('applies data-theme to <html> when theme changes', () => {
    renderProbe();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    act(() => screen.getByText('set-light').click());
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('persists the theme to localStorage when it changes', () => {
    renderProbe();
    act(() => screen.getByText('set-light').click());
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
  });

  it('setTheme rejects invalid values', () => {
    renderProbe();
    act(() => screen.getByText('set-invalid').click());
    expect(screen.getByTestId('theme').textContent).toBe('dark');
  });

  it('toggleTheme flips between dark and light', () => {
    renderProbe();
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    act(() => screen.getByText('toggle').click());
    expect(screen.getByTestId('theme').textContent).toBe('light');
    act(() => screen.getByText('toggle').click());
    expect(screen.getByTestId('theme').textContent).toBe('dark');
  });

  it('useTheme throws when used outside ThemeProvider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/useTheme must be used within ThemeProvider/);
    errorSpy.mockRestore();
  });
});
