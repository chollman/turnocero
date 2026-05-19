import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from './Pagination';

describe('<Pagination>', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onPage={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders page numbers with prev/next arrows', () => {
    render(<Pagination page={1} totalPages={3} onPage={vi.fn()} />);
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '‹' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '›' })).not.toBeDisabled();
  });

  it('disables next arrow on the last page', () => {
    render(<Pagination page={3} totalPages={3} onPage={vi.fn()} />);
    expect(screen.getByRole('button', { name: '›' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '‹' })).not.toBeDisabled();
  });

  it('calls onPage when clicking a page number', () => {
    const onPage = vi.fn();
    render(<Pagination page={1} totalPages={5} onPage={onPage} />);
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(onPage).toHaveBeenCalledWith(3);
  });

  it('calls onPage(page-1) on prev, onPage(page+1) on next', () => {
    const onPage = vi.fn();
    render(<Pagination page={3} totalPages={5} onPage={onPage} />);
    fireEvent.click(screen.getByRole('button', { name: '‹' }));
    expect(onPage).toHaveBeenLastCalledWith(2);
    fireEvent.click(screen.getByRole('button', { name: '›' }));
    expect(onPage).toHaveBeenLastCalledWith(4);
  });

  it('renders ellipsis when there are many pages and current is in the middle', () => {
    render(<Pagination page={10} totalPages={20} onPage={vi.fn()} />);
    const ellipses = screen.getAllByText('…');
    expect(ellipses.length).toBeGreaterThanOrEqual(1);
    // First page link always shown
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    // Last page link always shown
    expect(screen.getByRole('button', { name: '20' })).toBeInTheDocument();
  });

  it('marks the current page as active', () => {
    render(<Pagination page={2} totalPages={5} onPage={vi.fn()} />);
    const activeBtn = screen.getByRole('button', { name: '2' });
    expect(activeBtn.className).toMatch(/active/i);
  });
});
