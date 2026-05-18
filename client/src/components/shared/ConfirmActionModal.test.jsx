import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmActionModal from './ConfirmActionModal';

describe('<ConfirmActionModal>', () => {
  const baseProps = {
    isOpen: true,
    title: '¿Estás seguro?',
    message: 'Esta acción no se puede deshacer.',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<ConfirmActionModal {...baseProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title + message + default button labels', () => {
    render(<ConfirmActionModal {...baseProps} />);
    expect(screen.getByText('¿Estás seguro?')).toBeInTheDocument();
    expect(screen.getByText('Esta acción no se puede deshacer.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('overrides default labels', () => {
    render(
      <ConfirmActionModal {...baseProps} confirmLabel="Borrar" cancelLabel="Volver" />,
    );
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
  });

  it('calls onConfirm() with the current input value when given inputLabel', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmActionModal
        {...baseProps}
        onConfirm={onConfirm}
        inputLabel="Motivo"
        inputPlaceholder="..."
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('...'), { target: { value: 'spam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onConfirm).toHaveBeenCalledWith('spam');
  });

  it('calls onConfirm() with empty string when there is no input', () => {
    const onConfirm = vi.fn();
    render(<ConfirmActionModal {...baseProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onConfirm).toHaveBeenCalledWith('');
  });

  it('cancel button calls onCancel', () => {
    const onCancel = vi.fn();
    render(<ConfirmActionModal {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('clicking the overlay calls onCancel (unless loading)', () => {
    const onCancel = vi.fn();
    const { container, rerender } = render(
      <ConfirmActionModal {...baseProps} onCancel={onCancel} />,
    );
    fireEvent.click(container.firstChild);
    expect(onCancel).toHaveBeenCalledTimes(1);

    onCancel.mockClear();
    rerender(<ConfirmActionModal {...baseProps} onCancel={onCancel} loading />);
    fireEvent.click(container.firstChild);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('disables both buttons when loading', () => {
    render(<ConfirmActionModal {...baseProps} loading />);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '...' })).toBeDisabled();
  });

  it('resets input value when re-opened', () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <ConfirmActionModal
        {...baseProps}
        onConfirm={onConfirm}
        inputLabel="Notas"
      />,
    );
    // type something
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'first' } });

    // close + reopen
    rerender(<ConfirmActionModal {...baseProps} onConfirm={onConfirm} inputLabel="Notas" isOpen={false} />);
    rerender(<ConfirmActionModal {...baseProps} onConfirm={onConfirm} inputLabel="Notas" isOpen />);

    // input should be reset (empty)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onConfirm).toHaveBeenCalledWith('');
  });
});
