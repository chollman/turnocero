import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import EventoSkeleton from './EventoSkeleton';

describe('<EventoSkeleton>', () => {
  it('renders the timeline variant by default', () => {
    const { container } = render(<EventoSkeleton />);
    // root has multiple shimmer lines
    const lines = container.querySelectorAll('[class*="line"]');
    expect(lines.length).toBeGreaterThan(3);
  });

  it('renders the poster variant when requested', () => {
    const { container } = render(<EventoSkeleton variant="poster" />);
    // poster wrapper has aspect-ratio styling and contains lines
    const poster = container.querySelector('[class*="poster"]');
    expect(poster).not.toBeNull();
  });

  it('does not crash with no props', () => {
    expect(() => render(<EventoSkeleton />)).not.toThrow();
  });
});
