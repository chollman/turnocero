import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';

describe('<Modal>', () => {
  it('no renderiza nada cuando isOpen=false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={vi.fn()} ariaLabel="x">contenido</Modal>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza con role=dialog y aria-modal cuando isOpen', () => {
    render(
      <Modal isOpen onClose={vi.fn()} ariaLabel="Confirmar">contenido</Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Confirmar');
    expect(screen.getByText('contenido')).toBeInTheDocument();
  });

  it('Escape llama onClose', () => {
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose} ariaLabel="x">x</Modal>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('click en backdrop llama onClose por defecto', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal isOpen onClose={onClose} ariaLabel="x" backdropClassName="bd">x</Modal>,
    );
    const bd = container.querySelector('.bd');
    fireEvent.click(bd);
    expect(onClose).toHaveBeenCalled();
  });

  it('click adentro del contenedor NO llama onClose (event no propaga)', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} ariaLabel="x">
        <button>boton</button>
      </Modal>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'boton' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('dismissOnBackdrop=false no cierra con click en backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal isOpen onClose={onClose} ariaLabel="x" backdropClassName="bd" dismissOnBackdrop={false}>x</Modal>,
    );
    fireEvent.click(container.querySelector('.bd'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('focus se mueve al contenedor al abrir y se restaura al cerrar', () => {
    function Wrapper({ open }) {
      return (
        <>
          <button data-testid="trigger">trigger</button>
          <Modal isOpen={open} onClose={vi.fn()} ariaLabel="x">
            <p>modal content</p>
          </Modal>
        </>
      );
    }
    const { rerender } = render(<Wrapper open={false} />);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    rerender(<Wrapper open />);
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(dialog);

    rerender(<Wrapper open={false} />);
    expect(document.activeElement).toBe(trigger);
  });

  it('aria-labelledby tiene prioridad sobre aria-label', () => {
    render(
      <Modal isOpen onClose={vi.fn()} ariaLabel="ignored" ariaLabelledBy="titleId">
        <h2 id="titleId">Título</h2>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'titleId');
    expect(dialog).not.toHaveAttribute('aria-label');
  });
});
