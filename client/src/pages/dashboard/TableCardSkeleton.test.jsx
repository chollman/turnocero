import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TableCardSkeleton from './TableCardSkeleton';

describe('<TableCardSkeleton>', () => {
  it('renders an aria-hidden placeholder', () => {
    const { container } = render(<TableCardSkeleton />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});
