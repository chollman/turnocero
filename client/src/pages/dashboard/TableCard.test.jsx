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
        HttpResponse.json({ ...table, players: [{ _id: 'me', username: 'me' }] }),
      ),
    );
    render(
      <MemoryRouter>
        <TableCard table={table} onUpdate={onUpdate} onCancel={vi.fn()} />
      </MemoryRouter>,
    );
    // Find the join CTA (text varies); look for a button.
    const join = screen.getByRole('button', { name: /unirme|sumarme|unirse/i });
    fireEvent.click(join);
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
  });
});
