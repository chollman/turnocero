import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

const useAuthMock = vi.fn();
const useSiteConfigMock = vi.fn();

vi.mock('../../context/AuthContext', () => ({ useAuth: () => useAuthMock() }));
vi.mock('../../context/SiteConfigContext', () => ({ useSiteConfig: () => useSiteConfigMock() }));
vi.mock('../../components/shared/GameTile', () => ({
  default: ({ game }) => <div data-testid="game-tile">{game}</div>,
}));
vi.mock('./BgWatchHomeWidget', () => ({ default: () => <div data-testid="bg-widget" /> }));

import CompartidasSidebar from './CompartidasSidebar';

function renderSidebar() {
  return render(
    <MemoryRouter>
      <CompartidasSidebar />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthMock.mockReturnValue({ user: { _id: 'me', username: 'me' } });
  useSiteConfigMock.mockReturnValue({
    isSectionEnabled: (key) => true,
  });
  server.use(
    http.get('/api/tables/mine', () =>
      HttpResponse.json({
        tables: [
          {
            _id: 't1',
            boardGame: 'Catán',
            date: new Date(Date.now() + 86400000).toISOString(),
            maxPlayers: 4,
            players: [{ _id: 'p1' }],
            status: 'open',
          },
        ],
      }),
    ),
    http.get('/api/tables/top-games', () =>
      HttpResponse.json([
        { game: 'Catán', count: 25 },
        { game: 'Carcassonne', count: 15 },
      ]),
    ),
  );
});

describe('<CompartidasSidebar>', () => {
  it('renders the BgWatchHomeWidget when bgwatch is enabled', () => {
    renderSidebar();
    expect(screen.getByTestId('bg-widget')).toBeInTheDocument();
  });

  it('hides BgWatchHomeWidget when section is disabled', () => {
    useSiteConfigMock.mockReturnValue({
      isSectionEnabled: (key) => key !== 'bgwatch',
    });
    renderSidebar();
    expect(screen.queryByTestId('bg-widget')).not.toBeInTheDocument();
  });

  it('renders the próximas mesas widget when mesas is enabled', () => {
    renderSidebar();
    expect(screen.getByText('Próximas partidas')).toBeInTheDocument();
  });

  it('hides the mesas widget when section is disabled', () => {
    useSiteConfigMock.mockReturnValue({
      isSectionEnabled: (key) => key !== 'mesas',
    });
    renderSidebar();
    expect(screen.queryByText('Próximas partidas')).not.toBeInTheDocument();
    expect(screen.queryByText('Top juegos esta semana')).not.toBeInTheDocument();
  });

  it('renders upcoming tables after fetch', async () => {
    renderSidebar();
    await waitFor(() => {
      // "Catán" appears in the GameTile stub, tableGame span, and the top-games gameName span.
      expect(screen.getAllByText('Catán').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('renders the empty state when no upcoming tables', async () => {
    server.use(
      http.get('/api/tables/mine', () => HttpResponse.json({ tables: [] })),
    );
    renderSidebar();
    await waitFor(() => {
      expect(screen.getByText(/sin mesas próximas/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /\+ crear mesa/i })).toHaveAttribute('href', '/mesas/crear');
  });

  it('renders top games with rank and count', async () => {
    renderSidebar();
    await waitFor(() => {
      expect(screen.getByText('Top juegos esta semana')).toBeInTheDocument();
    });
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('Carcassonne')).toBeInTheDocument();
  });

  it('renders empty top-games state when API returns []', async () => {
    server.use(
      http.get('/api/tables/top-games', () => HttpResponse.json([])),
    );
    renderSidebar();
    await waitFor(() => {
      expect(screen.getByText(/sin datos esta semana/i)).toBeInTheDocument();
    });
  });

  it('renders nothing for guests (no user)', () => {
    useAuthMock.mockReturnValue({ user: null });
    renderSidebar();
    expect(screen.queryByTestId('bg-widget')).not.toBeInTheDocument();
  });
});
