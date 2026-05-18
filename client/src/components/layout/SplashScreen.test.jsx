import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import SplashScreen from './SplashScreen';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('<SplashScreen>', () => {
  it('renders the logo, title and subtitle when visible', () => {
    render(<SplashScreen visible={true} />);
    expect(screen.getByText('Turnocero')).toBeInTheDocument();
    expect(screen.getByText('🎲')).toBeInTheDocument();
    expect(screen.getByText('Organizá tu mesa')).toBeInTheDocument();
  });

  it('renders 15 decorative pieces', () => {
    const { container } = render(<SplashScreen visible={true} />);
    // Each piece is a <span class*=piece>, content text matches one of the symbols.
    // Count by looking at direct children spans inside the splash.
    const root = container.querySelector('div[aria-hidden="true"]');
    expect(root).toBeTruthy();
    const pieces = root.querySelectorAll(':scope > span');
    expect(pieces.length).toBe(15);
  });

  it('keeps rendering after visible=false until the fade-out timer completes (700ms)', () => {
    const { rerender, container } = render(<SplashScreen visible={true} />);
    expect(container.firstChild).not.toBeNull();
    rerender(<SplashScreen visible={false} />);
    // Still rendered immediately with the hiding class
    expect(container.firstChild).not.toBeNull();
    // After 700ms it unmounts
    act(() => { vi.advanceTimersByTime(700); });
    expect(container.firstChild).toBeNull();
  });
});
