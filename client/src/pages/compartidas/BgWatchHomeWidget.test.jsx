import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import BgWatchHomeWidget from './BgWatchHomeWidget';

const DISMISS_KEY = 'turnocero_bgwatch_promo_dismissed';

function renderWidget(props = {}) {
  return render(
    <MemoryRouter>
      <BgWatchHomeWidget user={props.user} dismissible={props.dismissible} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.removeItem(DISMISS_KEY);
  server.use(
    http.get('/api/bgg/partidas/:bggUsername', () =>
      HttpResponse.json({
        plays: [
          { id: 'p1', gameId: 13, gameName: 'Catán', gameThumbnail: 'https://cdn/c.jpg', date: '2026-05-01', players: [{ username: 'CarcaFan', win: true }] },
          { id: 'p2', gameId: 14, gameName: 'Carcassonne', gameThumbnail: null, date: '2026-04-30', players: [] },
        ],
      }),
    ),
  );
});

describe('<BgWatchHomeWidget>', () => {
  it('renders nothing when no user', () => {
    const { container } = renderWidget({ user: null });
    expect(container.firstChild).toBeNull();
  });

  it('renders the PromoView when user has no BG Watch connection', () => {
    renderWidget({ user: { _id: 'me', username: 'me' } });
    expect(screen.getByText(/¿Llevás tus partidas en BGG\?/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /activá bg watch/i })).toHaveAttribute('href', '/bg-watch');
  });

  it('does NOT show dismiss button when not dismissible', () => {
    renderWidget({ user: { _id: 'me' } });
    expect(screen.queryByLabelText(/no volver a mostrar/i)).not.toBeInTheDocument();
  });

  it('shows dismiss button when dismissible=true', () => {
    renderWidget({ user: { _id: 'me' }, dismissible: true });
    expect(screen.getByLabelText(/no volver a mostrar/i)).toBeInTheDocument();
  });

  it('clicking dismiss removes the widget and writes to localStorage', () => {
    const { container } = renderWidget({ user: { _id: 'me' }, dismissible: true });
    fireEvent.click(screen.getByLabelText(/no volver a mostrar/i));
    expect(container.firstChild).toBeNull();
    expect(localStorage.getItem(DISMISS_KEY)).toBe('1');
  });

  it('returns null when promo was already dismissed', () => {
    localStorage.setItem(DISMISS_KEY, '1');
    const { container } = renderWidget({ user: { _id: 'me' }, dismissible: true });
    expect(container.firstChild).toBeNull();
  });

  it('renders ConnectedView when user has bggConnected', async () => {
    renderWidget({ user: { _id: 'me', bggUsername: 'CarcaFan', bggConnected: true, bggInvalid: false } });
    expect(screen.getByText('Últimas partidas')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Catán')).toBeInTheDocument();
      expect(screen.getByText('Carcassonne')).toBeInTheDocument();
    });
  });

  it('renders empty state when ConnectedView has no plays', async () => {
    server.use(
      http.get('/api/bgg/partidas/:bggUsername', () => HttpResponse.json({ plays: [] })),
    );
    renderWidget({ user: { _id: 'me', bggUsername: 'CarcaFan', bggConnected: true } });
    await waitFor(() => {
      expect(screen.getByText(/sin partidas registradas/i)).toBeInTheDocument();
    });
  });

  it('renders error state when API fails', async () => {
    server.use(
      http.get('/api/bgg/partidas/:bggUsername', () => HttpResponse.json({}, { status: 500 })),
    );
    renderWidget({ user: { _id: 'me', bggUsername: 'CarcaFan', bggConnected: true } });
    await waitFor(() => {
      expect(screen.getByText(/no se pudieron cargar/i)).toBeInTheDocument();
    });
  });

  it('renders PromoView (not ConnectedView) when bggInvalid is true', () => {
    renderWidget({ user: { _id: 'me', bggUsername: 'CarcaFan', bggConnected: true, bggInvalid: true } });
    expect(screen.getByText(/¿Llevás tus partidas en BGG\?/i)).toBeInTheDocument();
  });

  it('"Ver todo →" links to /bg-watch/:bggUsername', () => {
    renderWidget({ user: { _id: 'me', bggUsername: 'CarcaFan', bggConnected: true } });
    expect(screen.getByRole('link', { name: /ver todo/i })).toHaveAttribute('href', '/bg-watch/CarcaFan');
  });
});
