import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

import TableCard from './TableCard';
import { useAuth } from '../../context/AuthContext';

function makeTable(overrides = {}) {
  return {
    _id: overrides._id || 't1',
    boardGame: 'Catán',
    date: new Date(Date.now() + 7 * 86400000).toISOString(),
    maxPlayers: 4,
    players: [],
    location: 'Buenos Aires',
    host: { _id: 'host1', username: 'thehost', avatar: { url: '', publicId: '' } },
    status: 'open',
    privacy: 'public',
    pendingRequests: [],
    ...overrides,
  };
}

function renderCard(table, { user = { _id: 'me', username: 'me' } } = {}) {
  useAuth.mockReturnValue({ user });
  return render(
    <MemoryRouter>
      <TableCard table={table} onUpdate={vi.fn()} onCancel={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('<TableCard>', () => {
  it('renders the game name, location, and host', () => {
    renderCard(makeTable());
    expect(screen.getByText('Catán')).toBeInTheDocument();
    expect(screen.getByText('Buenos Aires')).toBeInTheDocument();
    expect(screen.getByText('thehost')).toBeInTheDocument();
  });

  it('shows HOST badge when the current user is the host', () => {
    renderCard(
      makeTable({ host: { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } } }),
      { user: { _id: 'me', username: 'me' } },
    );
    expect(screen.getByText(/^HOST$/)).toBeInTheDocument();
  });

  it('shows UNIDO badge when the current user is in players', () => {
    renderCard(
      makeTable({ players: [{ _id: 'me', username: 'me', avatar: { url: '', publicId: '' } }] }),
      { user: { _id: 'me', username: 'me' } },
    );
    expect(screen.getByText(/^UNIDO$/)).toBeInTheDocument();
  });

  it('shows seat count "1/5" with no players (just the host) on a 4-max table', () => {
    renderCard(makeTable({ maxPlayers: 4, players: [] }));
    expect(screen.getByText('1/5')).toBeInTheDocument();
  });

  it('renders "Usuario eliminado" when host is null (deleted)', () => {
    renderCard(makeTable({ host: null }));
    expect(screen.getByText('Usuario eliminado')).toBeInTheDocument();
  });

  it('non-host non-player: clicking the join button hits the API and bumps players list via onUpdate', async () => {
    const onUpdate = vi.fn();
    const table = makeTable();
    useAuth.mockReturnValue({ user: { _id: 'me', username: 'me' } });
    server.use(
      http.post('/api/tables/:id/join', () =>
        HttpResponse.json({ table: { ...table, players: [{ _id: 'me', username: 'me' }] } }),
      ),
    );
    render(
      <MemoryRouter>
        <TableCard table={table} onUpdate={onUpdate} onCancel={vi.fn()} />
      </MemoryRouter>,
    );
    const join = screen.getByRole('button', { name: /unirme|sumarme|unirse/i });
    fireEvent.click(join);
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
  });

  // ─── List mode ───
  describe('list mode', () => {
    function renderList(table, opts = {}) {
      useAuth.mockReturnValue({ user: opts.user || { _id: 'me', username: 'me' } });
      return render(
        <MemoryRouter>
          <TableCard table={table} onUpdate={vi.fn()} onCancel={vi.fn()} listMode />
        </MemoryRouter>,
      );
    }

    it('renders in list mode with player count formatted', () => {
      renderList(makeTable({ maxPlayers: 4, players: [{ _id: 'p1' }] }));
      // Player count "X / Y" — 2 / 5 (host + 1 player out of max + 1)
      expect(screen.getByText(/2 \/ 5/)).toBeInTheDocument();
    });

    it('shows HOST badge and host-only icons in list mode when user is host', () => {
      renderList(
        makeTable({ host: { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } } }),
      );
      expect(screen.getByText(/^HOST$/)).toBeInTheDocument();
      expect(screen.getByTitle('Editar')).toBeInTheDocument();
      expect(screen.getByTitle('Cancelar')).toBeInTheDocument();
    });

    it('shows "Solicitud enviada · Cancelar" when user has pending request', () => {
      renderList(makeTable({ pendingRequests: [{ _id: 'me' }] }));
      expect(screen.getByRole('button', { name: /solicitud enviada/i })).toBeInTheDocument();
    });

    it('shows "Solicitar" CTA for private tables', () => {
      renderList(makeTable({ privacy: 'private' }));
      expect(screen.getByRole('button', { name: /solicitar/i })).toBeInTheDocument();
      // "Privada" badge present
      expect(screen.getByText('Privada')).toBeInTheDocument();
    });

    it('shows "Llena" CTA when table is full', () => {
      renderList(makeTable({ maxPlayers: 1, players: [{ _id: 'p1' }] }));
      expect(screen.getByRole('button', { name: /^Llena$/i })).toBeInTheDocument();
    });
  });

  it('grid mode: shows "Llena" disabled button when table is full', () => {
    renderCard(makeTable({ maxPlayers: 2, players: [{ _id: 'p1' }, { _id: 'p2' }] }));
    expect(screen.getByRole('button', { name: /^Llena$/ })).toBeDisabled();
  });

  it('grid mode: host actions show Editar/Cancelar/Administrar buttons', () => {
    renderCard(
      makeTable({ host: { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } } }),
      { user: { _id: 'me', username: 'me' } },
    );
    expect(screen.getByTitle('Editar mesa')).toBeInTheDocument();
    expect(screen.getByTitle('Cancelar mesa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /administrar/i })).toBeInTheDocument();
  });

  it('grid mode: player actions show "Abrir mesa" button', () => {
    renderCard(
      makeTable({ players: [{ _id: 'me', username: 'me' }] }),
      { user: { _id: 'me', username: 'me' } },
    );
    expect(screen.getByRole('button', { name: /abrir mesa/i })).toBeInTheDocument();
    expect(screen.getByTitle('Abandonar mesa')).toBeInTheDocument();
  });

  it('grid mode: pending request → "Cancelar solicitud" button', () => {
    renderCard(makeTable({ pendingRequests: [{ _id: 'me' }] }));
    expect(screen.getByRole('button', { name: /cancelar solicitud/i })).toBeInTheDocument();
  });

  it('shows admin tab when user is admin and not host/player', () => {
    renderCard(makeTable(), { user: { _id: 'me', isAdmin: true, username: 'admin' } });
    expect(screen.getByRole('button', { name: /admin/i })).toBeInTheDocument();
  });

  it('non-logged-in user clicking Unirme opens LoginPromptModal', () => {
    useAuth.mockReturnValue({ user: null });
    render(
      <MemoryRouter>
        <TableCard table={makeTable()} onUpdate={vi.fn()} onCancel={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /unirme/i }));
    // The modal copy contains "Iniciá sesión para unirte..." — match the unique part
    expect(screen.getByText(/para unirte/i)).toBeInTheDocument();
  });

  it('handleLeave hits the API and calls onUpdate', async () => {
    const onUpdate = vi.fn();
    const table = makeTable({ players: [{ _id: 'me', username: 'me' }] });
    useAuth.mockReturnValue({ user: { _id: 'me', username: 'me' } });
    server.use(
      http.post('/api/tables/:id/leave', () =>
        HttpResponse.json({ ...table, players: [] }),
      ),
    );
    render(
      <MemoryRouter>
        <TableCard table={table} onUpdate={onUpdate} onCancel={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTitle('Abandonar mesa'));
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
  });

  it('handleCancelRequest hits DELETE /request and calls onUpdate', async () => {
    const onUpdate = vi.fn();
    const table = makeTable({ pendingRequests: [{ _id: 'me' }] });
    useAuth.mockReturnValue({ user: { _id: 'me', username: 'me' } });
    server.use(
      http.delete('/api/tables/:id/request', () =>
        HttpResponse.json({ table: { ...table, pendingRequests: [] } }),
      ),
    );
    render(
      <MemoryRouter>
        <TableCard table={table} onUpdate={onUpdate} onCancel={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancelar solicitud/i }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
  });

  it('handleCancel (host) confirms and DELETEs the table', async () => {
    const onCancel = vi.fn();
    const table = makeTable({ host: { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } } });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    useAuth.mockReturnValue({ user: { _id: 'me', username: 'me' } });
    server.use(
      http.delete('/api/tables/:id', () => HttpResponse.json({ ok: true })),
    );
    render(
      <MemoryRouter>
        <TableCard table={table} onUpdate={vi.fn()} onCancel={onCancel} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTitle('Cancelar mesa'));
    await waitFor(() => expect(onCancel).toHaveBeenCalledWith(table._id));
    confirmSpy.mockRestore();
  });
});
