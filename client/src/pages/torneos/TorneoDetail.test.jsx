import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../context/NotificationContext', () => ({ useNotifications: vi.fn() }));

// Heavy child components — stub for focus.
vi.mock('./components/AdminPanel', () => ({
  default: ({ onReorderSeeds, onAddParticipants, onDelete }) => (
    <div data-testid="admin-panel">
      <button onClick={() => onReorderSeeds?.()}>admin-reorder</button>
      <button onClick={() => onAddParticipants?.()}>admin-add-participants</button>
      <button onClick={() => onDelete?.()}>admin-delete</button>
    </div>
  ),
}));
vi.mock('./components/RegistrationsList',  () => ({ default: () => null }));
vi.mock('./components/ParticipantsList',   () => ({ default: () => <div data-testid="participants" /> }));
vi.mock('./components/RegisterButton',     () => ({ default: () => <button>Inscribirme</button> }));
vi.mock('./components/LeagueStandings',    () => ({ default: () => <div data-testid="league-standings" /> }));
vi.mock('./components/LeagueRoundsList',   () => ({ default: () => <div data-testid="rounds-list" /> }));
vi.mock('./components/Bracket',            () => ({ default: () => <div data-testid="bracket" /> }));
vi.mock('./components/RecordResultModal',  () => ({ default: () => null }));
vi.mock('./components/SeedReorderModal',   () => ({ default: () => <div data-testid="seed-reorder-modal" /> }));
vi.mock('./components/AddParticipantModal',() => ({ default: () => <div data-testid="add-participant-modal" /> }));
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

  it('clicking "Partidos" tab renders the rounds list', async () => {
    renderDetail();
    await screen.findByText('Liga Catán 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Partidos' }));
    expect(screen.getByTestId('rounds-list')).toBeInTheDocument();
  });

  it('clicking "Participantes" tab renders the participants list', async () => {
    renderDetail();
    await screen.findByText('Liga Catán 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Participantes' }));
    expect(screen.getByTestId('participants')).toBeInTheDocument();
  });

  it('admin with registration status sees the pending registrations section', async () => {
    setupTorneo(makeTorneo({ status: 'registration' }));
    renderDetail({ isActuallyAdmin: true, viewAsUser: false });
    await screen.findByText('Liga Catán 2026');
    expect(screen.getByText(/inscripciones pendientes/i)).toBeInTheDocument();
  });

  it('torneo with a winner shows the champion row', async () => {
    const winner = { _id: 'w1', username: 'champion', avatar: { url: '', publicId: '' } };
    setupTorneo(makeTorneo({ status: 'finished', winner }));
    renderDetail();
    await screen.findByText('Liga Catán 2026');
    expect(screen.getByText(/campe[oó]n/i)).toBeInTheDocument();
  });

  it('torneo with winner AND runnerUp shows both podium rows', async () => {
    const winner   = { _id: 'w1', username: 'champion', avatar: { url: '', publicId: '' } };
    const runnerUp = { _id: 'w2', username: 'second',   avatar: { url: '', publicId: '' } };
    setupTorneo(makeTorneo({ status: 'finished', winner, runnerUp }));
    renderDetail();
    await screen.findByText('Liga Catán 2026');
    expect(screen.getByText(/subcampe[oó]n/i)).toBeInTheDocument();
  });

  it('shows 404 state when torneo does not exist', async () => {
    server.use(
      http.get('/api/torneos/:id', () => HttpResponse.json({ message: 'Not found' }, { status: 404 })),
    );
    renderDetail({ id: 'missing' });
    await waitFor(() => {
      expect(screen.getByText(/no encontrado/i)).toBeInTheDocument();
    });
  });

  it('admin clicking reorder seeds shows SeedReorderModal', async () => {
    renderDetail({ isActuallyAdmin: true, viewAsUser: false });
    await screen.findByText('Liga Catán 2026');
    fireEvent.click(screen.getByRole('button', { name: 'admin-reorder' }));
    expect(screen.getByTestId('seed-reorder-modal')).toBeInTheDocument();
  });

  it('admin clicking add participants shows AddParticipantModal', async () => {
    renderDetail({ isActuallyAdmin: true, viewAsUser: false });
    await screen.findByText('Liga Catán 2026');
    fireEvent.click(screen.getByRole('button', { name: 'admin-add-participants' }));
    expect(screen.getByTestId('add-participant-modal')).toBeInTheDocument();
  });

  it('single_elim bracket tab renders the bracket', async () => {
    setupTorneo(makeTorneo({ format: 'single_elim' }));
    renderDetail();
    await screen.findByText('Liga Catán 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Bracket' }));
    expect(screen.getByTestId('bracket')).toBeInTheDocument();
  });

  it('groups tab renders the groups view', async () => {
    setupTorneo(makeTorneo({ format: 'groups' }));
    server.use(
      http.get('/api/torneos/:id/groups', () => HttpResponse.json({ groups: [], currentPhase: 1 })),
    );
    renderDetail();
    await screen.findByText('Liga Catán 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Grupos' }));
    expect(screen.getByTestId('groups-view')).toBeInTheDocument();
  });
});
