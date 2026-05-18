import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

vi.mock('./PlayCard', () => ({
  default: ({ play }) => <div data-testid="play-card">{play.id}</div>,
}));
vi.mock('./PlayDetailModal', () => ({ default: () => null }));
vi.mock('./CreatePlayModal', () => ({ default: () => null }));
vi.mock('./Pagination', () => ({ default: () => null }));
vi.mock('./BgWatchGuestCTAs', () => ({ GuestBanner: () => null, GuestFooter: () => null }));
vi.mock('./useBggUserMap', () => ({ default: () => ({}) }));

import BgWatchPerGameView from './BgWatchPerGameView';
import { useAuth } from '../../context/AuthContext';

function renderView({ user = null, bggUsername = 'CarcaFan', gameId = '13' } = {}) {
  useAuth.mockReturnValue({ user });
  return render(
    <MemoryRouter initialEntries={[`/bg-watch/${bggUsername}/juego/${gameId}`]}>
      <Routes>
        <Route path="/bg-watch/:bggUsername/juego/:gameId" element={<BgWatchPerGameView />} />
      </Routes>
    </MemoryRouter>,
  );
}

const GAME = { id: 13, name: 'Catán', year: 1995, image: null, thumbnail: null };

beforeEach(() => {
  server.use(
    http.get('/api/bgg/game/:id', () => HttpResponse.json(GAME)),
    http.get('/api/bgg/partidas/:bggUsername', () =>
      HttpResponse.json({ plays: [], page: 1, total: 0, totalPages: 1 }),
    ),
  );
});

describe('<BgWatchPerGameView>', () => {
  it('renders the game name once loaded', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getAllByText(/Catán/).length).toBeGreaterThan(0);
    });
  });

  it('renders one PlayCard per play returned by the API', async () => {
    server.use(
      http.get('/api/bgg/partidas/:bggUsername', () =>
        HttpResponse.json({
          plays: [
            { id: 'p1', date: '2026-05-01', players: [] },
            { id: 'p2', date: '2026-05-02', players: [] },
          ],
          page: 1,
          total: 2,
          totalPages: 1,
        }),
      ),
    );
    renderView();
    await waitFor(() => {
      expect(screen.getAllByTestId('play-card').length).toBe(2);
    });
  });

  it('shows a not-found title when /game/:id fails', async () => {
    server.use(
      http.get('/api/bgg/game/:id', () =>
        HttpResponse.json({ message: 'No se pudo cargar el juego' }, { status: 500 })),
    );
    renderView();
    await waitFor(() => {
      expect(screen.getByText(/juego no encontrado/i)).toBeInTheDocument();
    });
  });

  it('shows the "Registrar partida" CTA when the user owns this BGG profile and is connected', async () => {
    renderView({
      user: { _id: 'me', username: 'me', bggUsername: 'CarcaFan', bggConnected: true, bggInvalid: false },
      bggUsername: 'CarcaFan',
    });
    await screen.findAllByText(/Catán/);
    expect(screen.getByRole('button', { name: /registrar partida|cargar partida|nueva partida|\+ partida/i })).toBeInTheDocument();
  });

  it('does NOT show the CTA when viewing someone else\'s profile', async () => {
    renderView({
      user: { _id: 'me', username: 'me', bggUsername: 'OtroUser', bggConnected: true },
      bggUsername: 'CarcaFan',
    });
    await screen.findAllByText(/Catán/);
    expect(screen.queryByRole('button', { name: /registrar partida|cargar partida|nueva partida|\+ partida/i })).not.toBeInTheDocument();
  });
});
