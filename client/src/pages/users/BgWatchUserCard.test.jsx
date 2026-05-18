import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import BgWatchUserCard from './BgWatchUserCard';

function renderCard(bggUsername = 'CarcaFan') {
  return render(
    <MemoryRouter>
      <BgWatchUserCard bggUsername={bggUsername} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  server.use(
    http.get('/api/bgg/partidas/:bggUsername', () =>
      HttpResponse.json({ plays: [{ id: 'p1', date: '2026-05-01' }], total: 42 }),
    ),
    http.get('/api/bgg/coleccion/:bggUsername', () =>
      HttpResponse.json([
        { id: 13, name: 'Catán', thumbnail: 'https://cdn/c.jpg', numPlays: 5 },
        { id: 14, name: 'Carcassonne', thumbnail: null, numPlays: 3 },
      ]),
    ),
  );
});

describe('<BgWatchUserCard>', () => {
  it('links to /bg-watch/:bggUsername', () => {
    renderCard('CarcaFan');
    expect(screen.getByRole('link').getAttribute('href')).toBe('/bg-watch/CarcaFan');
  });

  it('renders the bggUsername with @ prefix', () => {
    renderCard('CarcaFan');
    expect(screen.getByText('@CarcaFan')).toBeInTheDocument();
  });

  it('renders the avatar letter from the first char of bggUsername', () => {
    renderCard('CarcaFan');
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('shows "…" placeholders while loading', () => {
    renderCard();
    // Initial render before promises resolve — multiple "…" appear
    const placeholders = screen.getAllByText('…');
    expect(placeholders.length).toBeGreaterThan(0);
  });

  it('renders stats and top game once loaded', async () => {
    renderCard();
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // juegos en colección
    });
    expect(screen.getByText('Catán')).toBeInTheDocument();
    expect(screen.getByText(/5 partidas/i)).toBeInTheDocument();
  });

  it('shows error note when both APIs fail', async () => {
    server.use(
      http.get('/api/bgg/partidas/:bggUsername', () => HttpResponse.json({}, { status: 500 })),
      http.get('/api/bgg/coleccion/:bggUsername', () => HttpResponse.json({}, { status: 500 })),
    );
    renderCard();
    await waitFor(() => {
      expect(screen.getByText(/no se pudieron cargar las estadísticas/i)).toBeInTheDocument();
    });
  });

  it('shows "—" for missing data', async () => {
    server.use(
      http.get('/api/bgg/partidas/:bggUsername', () =>
        HttpResponse.json({ plays: [], total: 0 }),
      ),
      http.get('/api/bgg/coleccion/:bggUsername', () => HttpResponse.json([])),
    );
    renderCard();
    await waitFor(() => {
      expect(screen.getByText(/última partida/i)).toBeInTheDocument();
    });
    // total = 0, juegos = 0 — those show as "0", lastDate = null → "—"
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
