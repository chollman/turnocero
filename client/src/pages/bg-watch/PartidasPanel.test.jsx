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
  // default empty plays
  server.use(
    http.get('/api/bgg/partidas/:bggUsername', () =>
      HttpResponse.json({ plays: [], page: 1, total: 0, totalPages: 1 }),
    ),
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

  it('clicking a filter chip changes its active class', async () => {
    renderPanel();
    const yearBtn = screen.getByRole('button', { name: 'Este año' });
    fireEvent.click(yearBtn);
    // The button should now have active styling
    expect(yearBtn.className).toMatch(/active/i);
  });
});
