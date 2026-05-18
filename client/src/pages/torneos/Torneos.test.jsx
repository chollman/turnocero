import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

vi.mock('./components/TorneoCard', () => ({
  default: ({ torneo }) => (
    <div data-testid="torneo-card" data-status={torneo.status}>{torneo.title}</div>
  ),
}));

import Torneos from './Torneos';
import { useAuth } from '../../context/AuthContext';

function renderPage({ user = { _id: 'me' }, isActuallyAdmin = false, viewAsUser = false } = {}) {
  useAuth.mockReturnValue({ user, isActuallyAdmin, viewAsUser });
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <Torneos />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

function makeTorneo(overrides = {}) {
  return {
    _id: overrides._id || `t${Math.random()}`,
    title: overrides.title || 'Liga Catán 2026',
    status: overrides.status || 'registration',
    format: overrides.format || 'league',
    game: overrides.game || 'Catán',
    createdBy: { _id: 'admin' },
    ...overrides,
  };
}

beforeEach(() => {
  server.use(
    http.get('/api/torneos', () =>
      HttpResponse.json({
        torneos: [
          makeTorneo({ title: 'Open Tournament', status: 'registration' }),
          makeTorneo({ title: 'Finished Tournament', status: 'finished' }),
        ],
        page: 1,
        pages: 1,
        total: 2,
      }),
    ),
  );
});

describe('<Torneos>', () => {
  it('loads + renders the torneo list', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByTestId('torneo-card').length).toBe(2);
    });
    expect(screen.getByText('Open Tournament')).toBeInTheDocument();
    expect(screen.getByText('Finished Tournament')).toBeInTheDocument();
  });

  it('admin in admin mode sees the "Nuevo torneo" button', async () => {
    renderPage({ isActuallyAdmin: true, viewAsUser: false });
    await screen.findByText('Open Tournament');
    expect(screen.getByRole('button', { name: /nuevo torneo|crear torneo/i })).toBeInTheDocument();
  });

  it('admin viewing-as-user does NOT see the "Nuevo torneo" button', async () => {
    renderPage({ isActuallyAdmin: true, viewAsUser: true });
    await screen.findByText('Open Tournament');
    expect(screen.queryByRole('button', { name: /nuevo torneo|crear torneo/i })).not.toBeInTheDocument();
  });

  it('regular users do not see the "Nuevo torneo" button', async () => {
    renderPage({ isActuallyAdmin: false });
    await screen.findByText('Open Tournament');
    expect(screen.queryByRole('button', { name: /nuevo torneo|crear torneo/i })).not.toBeInTheDocument();
  });

  it('clicking a status tab re-fetches with the corresponding filter', async () => {
    let requestedStatus;
    server.use(
      http.get('/api/torneos', ({ request }) => {
        const url = new URL(request.url);
        requestedStatus = url.searchParams.get('status');
        return HttpResponse.json({ torneos: [], page: 1, pages: 1, total: 0 });
      }),
    );
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^en curso$/i }));
    await waitFor(() => expect(requestedStatus).toBe('in_progress'));
  });
});
