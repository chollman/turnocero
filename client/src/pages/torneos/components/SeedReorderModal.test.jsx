import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/server';
import SeedReorderModal from './SeedReorderModal';

const PLAYERS = [
  { _id: 'p1', username: 'alice', avatar: { url: '', publicId: '' } },
  { _id: 'p2', username: 'bob', avatar: { url: '', publicId: '' } },
  { _id: 'p3', username: 'carol', avatar: { url: '', publicId: '' } },
];

function renderModal({ torneo = { _id: 't1', participants: PLAYERS }, onClose = vi.fn(), onSaved = vi.fn() } = {}) {
  return render(
    <MemoryRouter>
      <SeedReorderModal torneo={torneo} onClose={onClose} onSaved={onSaved} />
    </MemoryRouter>,
  );
}

describe('<SeedReorderModal>', () => {
  it('renders one row per participant with seed numbers', () => {
    renderModal();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('disables ↑ on first item and ↓ on last item', () => {
    renderModal();
    const upButtons = screen.getAllByLabelText('Subir');
    const downButtons = screen.getAllByLabelText('Bajar');
    expect(upButtons[0]).toBeDisabled();
    expect(downButtons[downButtons.length - 1]).toBeDisabled();
  });

  it('clicking ↑ swaps the item up', () => {
    renderModal();
    // ModalPortal mounts outside container; query the whole document.
    const upButtons = screen.getAllByLabelText('Subir');
    fireEvent.click(upButtons[1]);
    const items = document.querySelectorAll('li');
    expect(items[0].textContent).toContain('bob');
  });

  it('clicking ↓ swaps the item down', () => {
    renderModal();
    const downButtons = screen.getAllByLabelText('Bajar');
    fireEvent.click(downButtons[0]);
    const items = document.querySelectorAll('li');
    expect(items[0].textContent).toContain('bob');
  });

  it('Cancel button calls onClose', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Save calls PATCH /seeds + onSaved', async () => {
    const onSaved = vi.fn();
    server.use(http.patch('/api/torneos/:id/seeds', () => HttpResponse.json({ ok: true })));
    renderModal({ onSaved });
    fireEvent.click(screen.getByRole('button', { name: /guardar orden/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('shows API error on failure', async () => {
    server.use(
      http.patch('/api/torneos/:id/seeds', () => HttpResponse.json({ message: 'No se pudo guardar' }, { status: 400 })),
    );
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /guardar orden/i }));
    expect(await screen.findByText('No se pudo guardar')).toBeInTheDocument();
  });
});
