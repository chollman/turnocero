import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

vi.mock('./FeedCard', () => ({
  default: ({ table }) => <div data-testid="feed-card">{table.boardGame}</div>,
}));
vi.mock('./FeedCardSkeleton', () => ({ default: () => <div data-testid="skeleton" /> }));
vi.mock('../../components/shared/GameTile', () => ({ default: () => null }));

import MeFeed from './MeFeed';
import { useAuth } from '../../context/AuthContext';

function makeTable(overrides = {}) {
  return {
    _id: overrides._id || `t${Math.random()}`,
    boardGame: overrides.boardGame || 'Catán',
    date: overrides.date || new Date(Date.now() + 7 * 86400000).toISOString(),
    maxPlayers: 4,
    players: overrides.players || [],
    location: 'BA',
    host: overrides.host || { _id: 'me' },
    status: overrides.status || 'open',
    ...overrides,
  };
}

function setup({ user = { _id: 'me', username: 'me' }, tables = [], friendsCount = 0 } = {}) {
  useAuth.mockReturnValue({ user });
  server.use(
    http.get('/api/tables/me/feed', () => HttpResponse.json({ tables })),
    http.get('/api/users/:id', () => HttpResponse.json({ friendsCount })),
  );
  return render(
    <MemoryRouter>
      <MeFeed />
    </MemoryRouter>,
  );
}

describe('<MeFeed>', () => {
  it('renders feed cards for each table', async () => {
    setup({
      tables: [
        makeTable({ boardGame: 'Catán' }),
        makeTable({ boardGame: 'Wingspan' }),
      ],
    });
    await waitFor(() => {
      expect(screen.getAllByTestId('feed-card').length).toBe(2);
    });
  });

  it('shows the empty-state subtitle when there are no tables', async () => {
    setup({ tables: [] });
    await waitFor(() => {
      expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Empezá a jugar|creá tu primera mesa/i)).toBeInTheDocument();
  });

  it('renders filter tabs (Todas / Anfitrión / Jugador / Canceladas)', async () => {
    setup({ tables: [makeTable()] });
    await screen.findAllByTestId('feed-card');
    expect(screen.getByRole('button', { name: /todas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /anfitri[oó]n/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /jugador/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /canceladas/i })).toBeInTheDocument();
  });

  it('clicking "Canceladas" filters by status=cancelled', async () => {
    setup({
      tables: [
        makeTable({ boardGame: 'Active', status: 'open' }),
        makeTable({ boardGame: 'Cancelled', status: 'cancelled' }),
      ],
    });
    await screen.findAllByTestId('feed-card');
    fireEvent.click(screen.getByRole('button', { name: /canceladas/i }));
    await waitFor(() => {
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
      expect(screen.queryByText('Active')).not.toBeInTheDocument();
    });
  });

  it('hostedCount in subtitle reflects how many tables the user hosts', async () => {
    setup({
      tables: [
        makeTable({ boardGame: 'A', host: { _id: 'me' } }),
        makeTable({ boardGame: 'B', host: { _id: 'me' } }),
        makeTable({ boardGame: 'C', host: { _id: 'other' } }),
      ],
    });
    await screen.findAllByTestId('feed-card');
    expect(screen.getByText(/2 mesas hosteadas/i)).toBeInTheDocument();
  });
});
