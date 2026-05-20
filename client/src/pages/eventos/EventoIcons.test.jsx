import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import * as Icons from './EventoIcons';

describe('EventoIcons', () => {
  it('exports a set of icon components', () => {
    const names = [
      'PinIcon', 'CalendarIcon', 'UsersIcon', 'ClockIcon', 'MoneyIcon',
      'ArrowIcon', 'ArrowLeftIcon', 'PlusIcon', 'GridIcon', 'ListIcon',
      'ImageIcon', 'CheckIcon', 'XIcon', 'EditIcon', 'TrashIcon',
      'DocIcon', 'EyeIcon', 'ExternalIcon', 'PaperclipIcon', 'RefreshIcon',
    ];
    for (const n of names) {
      expect(typeof Icons[n], `${n} should be a function`).toBe('function');
    }
  });

  it('renders an SVG for each icon', () => {
    Object.entries(Icons).forEach(([name, Cmp]) => {
      const { container } = render(<Cmp />);
      const svg = container.querySelector('svg');
      expect(svg, `${name} should render an SVG`).not.toBeNull();
    });
  });

  it('honors a custom size prop', () => {
    const { container } = render(<Icons.PinIcon size={32} />);
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('width')).toBe('32');
    expect(svg.getAttribute('height')).toBe('32');
  });
});
