import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../context/NotificationContext', () => ({ useNotifications: vi.fn() }));

// Heavy child components — stub for focus.
vi.mock('./components/AdminPanel',         () => ({ default: () => <div data-testid="admin-panel" /> }));
vi.mock('./components/RegistrationsList',  () => ({ default: () => null }));
vi.mock('./components/ParticipantsList',   () => ({ default: () => <div data-testid="participants" /> }));
vi.mock('./components/RegisterButton',     () => ({ default: () => <button>Inscribirme</button> }));
vi.mock('./components/LeagueStandings',    () => ({ default: () => <div data-testid="league-standings" /> }));
vi.mock('./components/LeagueRoundsList',   () => ({ default: () => null }));
vi.mock('./components/Bracket',            () => ({ default: () => <div data-testid="bracket" /> }));
vi.mock('./components/RecordResultModal',  () => ({ default: () => null }));
vi.mock('./components/SeedReorderModal',   () => ({ default: () => null }));
vi.mock('./components/AddParticipantModal',() => ({ default: () => null }));
vi.mock('./components/GroupsView',         () => ({ default: () => <div data-testid="groups-view" /> }));

import TorneoDetail from './TorneoDetail';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

function makeTorneo(overrides = {}) {
  return {
    _id: 't1',
    title: 'Liga Catán 2026',
    description: '',
    game: 'Catán',
    format: 'league',
    status: 'in_progress',
    inscriptionMode: 'open',
    participants: [],
    pendingRegistrations: [],
    rejectedRegistrations: [],
    createdBy: { _id: 'admin', username: 'admin', avatar: { url: '', publicId: '' } },
    winner: null,
    runnerUp: null,
    ...overrides,
  };
}

function setupTorneo(torneo) {
  server.use(
    http.get('/api/torneos/:id', () => HttpResponse.json(torneo)),
    http.get('/api/torneos/:id/matches', () => HttpResponse.json([])),
    http.get('/api/torneos/:id/standings', () => HttpResponse.json([])),
    http.get('/api/torneos/:id/groups', () => HttpResponse.json([])),
  );
}

function renderDetail({ user = null, isActuallyAdmin = false, viewAsUser = false, id = 't1' } = {}) {
  useAuth.mockReturnValue({ user, isActuallyAdmin, viewAsUser });
  useNotifications.mockReturnValue({ setActiveTorneo: vi.fn() });
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/torneos/${id}`]}>
        <Routes>
          <Route path="/torneos/:id" element={<TorneoDetail />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

beforeEach(() => {
  setupTorneo(makeTorneo());
});

describe('<TorneoDetail>', () => {
  it('renders the torneo title once loaded', async () => {
    renderDetail();
    expect(await screen.findByText('Liga Catán 2026')).toBeInTheDocument();
  });

  it('renders the league format label + standings tab (default for league)', async () => {
    renderDetail();
    await screen.findByText('Liga Catán 2026');
    expect(screen.getByText(/Liga \(todos contra todos\)/i)).toBeInTheDocument();
  });

  it('renders the single_elim Bracket tab when format=single_elim', async () => {
    setupTorneo(makeTorneo({ format: 'single_elim' }));
    renderDetail();
    await screen.findByText('Liga Catán 2026');
    expect(screen.getByText(/Eliminaci[oó]n simple/i)).toBeInTheDocument();
  });

  it('renders the groups tab when format=groups', async () => {
    setupTorneo(makeTorneo({ format: 'groups' }));
    renderDetail();
    await screen.findByText('Liga Catán 2026');
    expect(screen.getByText(/Grupos multi-fase/i)).toBeInTheDocument();
  });

  it('admin in admin mode sees AdminPanel', async () => {
    renderDetail({ isActuallyAdmin: true, viewAsUser: false });
    await screen.findByText('Liga Catán 2026');
    expect(screen.getByTestId('admin-panel')).toBeInTheDocument();
  });

  it('admin viewing as user does NOT see AdminPanel', async () => {
    renderDetail({ isActuallyAdmin: true, viewAsUser: true });
    await screen.findByText('Liga Catán 2026');
    expect(screen.queryByTestId('admin-panel')).not.toBeInTheDocument();
  });

  it('regular users do not see AdminPanel', async () => {
    renderDetail({ user: { _id: 'me' }, isActuallyAdmin: false });
    await screen.findByText('Liga Catán 2026');
    expect(screen.queryByTestId('admin-panel')).not.toBeInTheDocument();
  });

  it('shows the in-progress status chip', async () => {
    renderDetail();
    await screen.findByText('Liga Catán 2026');
    expect(screen.getByText(/En curso/i)).toBeInTheDocument();
  });

  it('shows finished chip when status=finished', async () => {
    setupTorneo(makeTorneo({ status: 'finished' }));
    renderDetail();
    await screen.findByText('Liga Catán 2026');
    expect(screen.getByText(/Finalizado/i)).toBeInTheDocument();
  });
});
