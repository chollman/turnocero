import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('./Pagination', () => ({
  default: ({ page, totalPages, onPage }) => (
    <div data-testid="pagination">
      <button onClick={() => onPage(2)}>page-2</button>
      <span>{page}/{totalPages}</span>
    </div>
  ),
}));

import ColeccionPanel from './ColeccionPanel';

function makeGame(overrides = {}) {
  return {
    id: 13,
    name: 'Catán',
    thumbnail: 'https://cdn/catan.jpg',
    yearPublished: 1995,
    userRating: 8.5,
    bggRating: 7.2,
    numPlays: 12,
    ...overrides,
  };
}

beforeEach(() => {
  // default: empty collection
  server.use(
    http.get('/api/bgg/coleccion/:bggUsername', () => HttpResponse.json([])),
  );
});

describe('<ColeccionPanel>', () => {
  it('shows loading state initially', () => {
    render(<ColeccionPanel bggUsername="CarcaFan" />);
    expect(screen.getByText(/cargando colección/i)).toBeInTheDocument();
  });

  it('shows empty state when user has no owned games', async () => {
    render(<ColeccionPanel bggUsername="CarcaFan" />);
    await waitFor(() => {
      expect(screen.getByText(/no tiene juegos marcados como propios/i)).toBeInTheDocument();
    });
  });

  it('renders game cards when the collection loads', async () => {
    server.use(
      http.get('/api/bgg/coleccion/:bggUsername', () =>
        HttpResponse.json([makeGame(), makeGame({ id: 14, name: 'Carcassonne' })]),
      ),
    );
    render(<ColeccionPanel bggUsername="CarcaFan" />);
    await waitFor(() => {
      expect(screen.getByText('Catán')).toBeInTheDocument();
      expect(screen.getByText('Carcassonne')).toBeInTheDocument();
    });
  });

  it('shows error message when API fails', async () => {
    server.use(
      http.get('/api/bgg/coleccion/:bggUsername', () =>
        HttpResponse.json({ message: 'BGG offline' }, { status: 503 }),
      ),
    );
    render(<ColeccionPanel bggUsername="CarcaFan" />);
    await waitFor(() => {
      expect(screen.getByText('BGG offline')).toBeInTheDocument();
    });
  });

  it('calls onLoaded callback with the collection data', async () => {
    server.use(
      http.get('/api/bgg/coleccion/:bggUsername', () =>
        HttpResponse.json([makeGame()]),
      ),
    );
    const onLoaded = vi.fn();
    render(<ColeccionPanel bggUsername="CarcaFan" onLoaded={onLoaded} />);
    await waitFor(() => {
      expect(onLoaded).toHaveBeenCalled();
      const arg = onLoaded.mock.calls[0][0];
      expect(arg.length).toBe(1);
    });
  });

  it('renders the pagination info with total count', async () => {
    const games = Array.from({ length: 50 }, (_, i) => makeGame({ id: i, name: `Game ${i}` }));
    server.use(
      http.get('/api/bgg/coleccion/:bggUsername', () => HttpResponse.json(games)),
    );
    render(<ColeccionPanel bggUsername="CarcaFan" />);
    await waitFor(() => {
      expect(screen.getByText(/50 juegos/)).toBeInTheDocument();
    });
  });

  it('paginates to next page when pagination triggers onPage', async () => {
    const games = Array.from({ length: 50 }, (_, i) => makeGame({ id: i, name: `Game ${i}` }));
    server.use(
      http.get('/api/bgg/coleccion/:bggUsername', () => HttpResponse.json(games)),
    );
    render(<ColeccionPanel bggUsername="CarcaFan" />);
    await waitFor(() => {
      expect(screen.getByText('Game 0')).toBeInTheDocument();
    });
    // Page 1: Game 0..23. Click "page-2" exposed by Pagination stub
    fireEvent.click(screen.getByText('page-2'));
    await waitFor(() => {
      expect(screen.getByText('Game 24')).toBeInTheDocument();
    });
  });

  it('shows "—" when userRating is null', async () => {
    server.use(
      http.get('/api/bgg/coleccion/:bggUsername', () =>
        HttpResponse.json([makeGame({ userRating: null, bggRating: 7.2 })]),
      ),
    );
    render(<ColeccionPanel bggUsername="CarcaFan" />);
    await waitFor(() => {
      expect(screen.getByText('Catán')).toBeInTheDocument();
    });
    // Tu nota → "—" (since userRating null)
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });
});
