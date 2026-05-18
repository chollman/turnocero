import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginPromptModal from './LoginPromptModal';
import { RouterOnly } from '../../test/wrappers/AllProviders';

describe('<LoginPromptModal>', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <LoginPromptModal isOpen={false} onClose={() => {}} message="hello" />,
      { wrapper: RouterOnly },
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows the default message when none is given', () => {
    render(<LoginPromptModal isOpen onClose={() => {}} />, { wrapper: RouterOnly });
    expect(screen.getByText('Iniciá sesión para continuar.')).toBeInTheDocument();
  });

  it('renders the custom message when provided', () => {
    render(<LoginPromptModal isOpen onClose={() => {}} message="Login pro joinear" />, {
      wrapper: RouterOnly,
    });
    expect(screen.getByText('Login pro joinear')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<LoginPromptModal isOpen onClose={onClose} />, { wrapper: RouterOnly });
    fireEvent.click(screen.getByLabelText('Cerrar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the overlay is clicked (but not the modal body)', () => {
    const onClose = vi.fn();
    const { container } = render(
      <LoginPromptModal isOpen onClose={onClose} />,
      { wrapper: RouterOnly },
    );
    // Overlay is the outermost div
    fireEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Clicking inside the modal body should NOT trigger onClose
    onClose.mockClear();
    fireEvent.click(screen.getByText('¡Sumate a la partida!'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders both CTAs to login and register', () => {
    render(<LoginPromptModal isOpen onClose={() => {}} />, { wrapper: RouterOnly });
    expect(screen.getByRole('button', { name: /sesi[oó]n/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /registrate/i })).toBeInTheDocument();
  });
});
