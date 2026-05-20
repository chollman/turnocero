import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('./PlayCard', () => ({
  default: ({ play, onClick }) => (
    <div data-testid="play-card" onClick={onClick}>{play.id}</div>
  ),
}));
vi.mock('./Pagination', () => ({ default: () => <div data-testid="pagination" /> }));
vi.mock('./useBggUserMap', () => ({ default: () => ({}) }));

import PartidasPanel from './PartidasPanel';

function renderPanel(props = {}) {
  return render(
    <MemoryRouter>
      <PartidasPanel
        bggUsername="CarcaFan"
        collection={props.collection ?? null}
        onPlayClick={props.onPlayClick || vi.fn()}
        onPlayEdit={props.onPlayEdit}
        onPlayDelete={props.onPlayDelete}
        onMetaChange={props.onMetaChange}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // default empty plays + empty server-aggregated games (forces fallback to
  // collection for the "Por juego" tab unless a test overrides).
  server.use(
    http.get('/api/bgg/partidas/:bggUsername', () =>
      HttpResponse.json({ plays: [], page: 1, total: 0, totalPages: 1 }),
    ),
    http.get('/api/bgg/juegos-jugados/:bggUsername', () => HttpResponse.json([])),
  );
});

describe('<PartidasPanel>', () => {
  it('shows loading state initially in list mode', () => {
    renderPanel();
    expect(screen.getByText(/cargando partidas/i)).toBeInTheDocument();
  });

  it('shows the four filter chips in list mode', async () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'Todas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Este año' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Este mes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7 días' })).toBeInTheDocument();
  });

  it('shows empty state when there are no plays (filter = all)', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText(/no tiene partidas registradas en bgg/i)).toBeInTheDocument();
    });
  });

  it('renders a PlayCard per play returned', async () => {
    server.use(
      http.get('/api/bgg/partidas/:bggUsername', () =>
        HttpResponse.json({
          plays: [
            { id: 'p1', players: [] },
            { id: 'p2', players: [] },
          ],
          page: 1,
          total: 2,
          totalPages: 1,
        }),
      ),
    );
    renderPanel();
    await waitFor(() => {
      expect(screen.getAllByTestId('play-card').length).toBe(2);
    });
  });

  it('shows error when the API fails', async () => {
    server.use(
      http.get('/api/bgg/partidas/:bggUsername', () =>
        HttpResponse.json({ message: 'BGG slow' }, { status: 500 }),
      ),
    );
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('BGG slow')).toBeInTheDocument();
    });
  });

  it('switches to "Por juego" mode when toggle clicked', async () => {
    renderPanel({
      collection: [
        { id: 13, name: 'Catán', thumbnail: null, yearPublished: 1995, numPlays: 5 },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Por juego' }));
    expect(screen.getByText('Catán')).toBeInTheDocument();
  });

  it('shows the empty-by-game state when no played games', async () => {
    renderPanel({
      collection: [
        { id: 13, name: 'Catán', numPlays: 0 },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Por juego' }));
    expect(screen.getByText(/no hay juegos con partidas registradas/i)).toBeInTheDocument();
  });

  it('prefers server-aggregated played games over the collection-derived list', async () => {
    server.use(
      http.get('/api/bgg/juegos-jugados/:bggUsername', () =>
        HttpResponse.json([
          // Played-but-not-owned game appears here but not in collection.
          { id: '999', name: 'Brass Birmingham', thumbnail: 'bb.jpg', numPlays: 42 },
          { id: '13',  name: 'Catán',            thumbnail: 'c.jpg',  numPlays: 5 },
        ]),
      ),
    );
    renderPanel({
      collection: [
        { id: 13, name: 'Catán', numPlays: 5 }, // only this in the BGG collection
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Por juego' }));
    await waitFor(() => {
      expect(screen.getByText('Brass Birmingham')).toBeInTheDocument();
    });
    expect(screen.getByText('Catán')).toBeInTheDocument();
  });

  it('shows played games even when the collection is empty (private collection case)', async () => {
    // H3rmit87-style: collection fetch returned 401 → caller passes [].
    // BggPlay sync still gives us the played games via the new endpoint.
    server.use(
      http.get('/api/bgg/juegos-jugados/:bggUsername', () =>
        HttpResponse.json([
          { id: '174430', name: 'Gloomhaven', thumbnail: 'g.jpg', numPlays: 32 },
        ]),
      ),
    );
    renderPanel({ collection: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Por juego' }));
    await waitFor(() => {
      expect(screen.getByText('Gloomhaven')).toBeInTheDocument();
    });
  });

  it('falls back to the collection when the server returns no aggregated games', async () => {
    // Default handler in beforeEach already returns [].
    renderPanel({
      collection: [
        { id: 13, name: 'Catán', numPlays: 5 },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Por juego' }));
    expect(screen.getByText('Catán')).toBeInTheDocument();
  });

  it('calls onMetaChange after first successful "all" load', async () => {
    server.use(
      http.get('/api/bgg/partidas/:bggUsername', () =>
        HttpResponse.json({
          plays: [{ id: 'p1', date: '2026-05-01', players: [] }],
          page: 1,
          total: 1,
          totalPages: 1,
        }),
      ),
    );
    const onMetaChange = vi.fn();
    renderPanel({ onMetaChange });
    await waitFor(() => {
      expect(onMetaChange).toHaveBeenCalled();
    });
    const arg = onMetaChange.mock.calls[0][0];
    expect(arg.total).toBe(1);
    expect(arg.lastDate).toBe('2026-05-01');
  });

  it('forwards topGame from the server response to onMetaChange', async () => {
    const topGame = { id: '13', name: 'Catán', thumbnail: 'c.jpg', numPlays: 7 };
    server.use(
      http.get('/api/bgg/partidas/:bggUsername', () =>
        HttpResponse.json({
          plays: [{ id: 'p1', date: '2026-05-01', players: [] }],
          page: 1,
          total: 1,
          totalPages: 1,
          topGame,
        }),
      ),
    );
    const onMetaChange = vi.fn();
    renderPanel({ onMetaChange });
    await waitFor(() => {
      expect(onMetaChange).toHaveBeenCalled();
    });
    expect(onMetaChange.mock.calls[0][0].topGame).toEqual(topGame);
  });

  it('passes topGame: null when the server omits it', async () => {
    server.use(
      http.get('/api/bgg/partidas/:bggUsername', () =>
        HttpResponse.json({
          plays: [],
          page: 1,
          total: 0,
          totalPages: 0,
        }),
      ),
    );
    const onMetaChange = vi.fn();
    renderPanel({ onMetaChange });
    await waitFor(() => {
      expect(onMetaChange).toHaveBeenCalled();
    });
    expect(onMetaChange.mock.calls[0][0].topGame).toBeNull();
  });

  it('clicking a filter chip changes its active class', async () => {
    renderPanel();
    const yearBtn = screen.getByRole('button', { name: 'Este año' });
    fireEvent.click(yearBtn);
    // The button should now have active styling
    expect(yearBtn.className).toMatch(/active/i);
  });

  it('clicking "Actualizar" re-fetches partidas with ?refresh=1', async () => {
    const requestedUrls = [];
    server.use(
      http.get('/api/bgg/partidas/:bggUsername', ({ request }) => {
        requestedUrls.push(request.url);
        return HttpResponse.json({ plays: [], page: 1, total: 0, totalPages: 1 });
      }),
    );

    renderPanel();
    await waitFor(() => {
      expect(requestedUrls.length).toBe(1);
    });
    // First (mount) request should NOT have refresh=1
    expect(requestedUrls[0]).not.toContain('refresh=1');

    fireEvent.click(screen.getByRole('button', { name: /actualizar partidas/i }));
    await waitFor(() => {
      expect(requestedUrls.length).toBe(2);
    });
    // Second (manual click) request should include refresh=1
    expect(requestedUrls[1]).toContain('refresh=1');
  });

  it('disables the refresh button while loading', async () => {
    renderPanel();
    const btn = screen.getByRole('button', { name: /actualizar partidas/i });
    expect(btn).toBeDisabled();
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });
  });

  it('shows a 60s countdown and stays disabled during the cooldown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderPanel();
      const btn = await screen.findByRole('button', { name: /actualizar partidas/i });
      await waitFor(() => { expect(btn).not.toBeDisabled(); });

      fireEvent.click(btn);

      // Cooldown active immediately after click
      expect(btn).toBeDisabled();
      expect(btn.textContent).toMatch(/esperá 60s/i);

      // Advance 30s — counter should be ~30s
      vi.advanceTimersByTime(30_000);
      await waitFor(() => {
        expect(btn.textContent).toMatch(/esperá 30s/i);
      });
      expect(btn).toBeDisabled();

      // Advance past the cooldown — button should be enabled again with the
      // plain "Actualizar" label
      vi.advanceTimersByTime(31_000);
      await waitFor(() => {
        expect(btn.textContent).toMatch(/^↻ actualizar$/i);
      });
      expect(btn).not.toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
