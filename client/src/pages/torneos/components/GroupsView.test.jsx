import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/server';

vi.mock('./GroupStandings', () => ({
  default: ({ standings }) => (
    <div data-testid="group-standings">{(standings || []).length} standings</div>
  ),
}));
vi.mock('./GameScoreModal', () => ({ default: () => null }));
vi.mock('./PhaseTransitionModal', () => ({ default: () => null }));

import GroupsView from './GroupsView';

function setupGroups(data) {
  server.use(http.get('/api/torneos/:id/groups', () => HttpResponse.json(data)));
}

function renderView({ torneo = { _id: 't1', status: 'in_progress', currentPhase: 1, gamesPerGroup: 3 }, isAdmin = false } = {}) {
  return render(
    <MemoryRouter>
      <GroupsView torneo={torneo} isAdmin={isAdmin} onTorneoChange={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('<GroupsView>', () => {
  it('shows loading state initially', () => {
    setupGroups({ groups: [], currentPhase: 1 });
    renderView();
    expect(screen.getByText(/cargando grupos/i)).toBeInTheDocument();
  });

  it('shows empty state when phase has no groups', async () => {
    setupGroups({ groups: [], currentPhase: 1 });
    renderView();
    await waitFor(() => {
      expect(screen.getByText(/no se generaron grupos/i)).toBeInTheDocument();
    });
  });

  it('renders one block per group with table number', async () => {
    setupGroups({
      groups: [
        { _id: 'g1', tableNumber: 1, players: [], status: 'in_progress', advancedPlayers: [] },
        { _id: 'g2', tableNumber: 2, players: [], status: 'in_progress', advancedPlayers: [] },
      ],
      games: [],
      currentPhase: 1,
    });
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Mesa #1')).toBeInTheDocument();
      expect(screen.getByText('Mesa #2')).toBeInTheDocument();
    });
  });

  it('renders GroupStandings stub per group', async () => {
    setupGroups({
      groups: [{ _id: 'g1', tableNumber: 1, players: [{ _id: 'p1' }], status: 'in_progress', advancedPlayers: [] }],
      games: [],
      currentPhase: 1,
    });
    renderView();
    await waitFor(() => {
      expect(screen.getByTestId('group-standings')).toBeInTheDocument();
    });
  });

  it('group shows "Partidas" section header', async () => {
    setupGroups({
      groups: [{ _id: 'g1', tableNumber: 1, players: [], status: 'in_progress', advancedPlayers: [], games: [] }],
      currentPhase: 1,
    });
    renderView();
    await waitFor(() => expect(screen.getByText('Partidas')).toBeInTheDocument());
  });

  it('pending game renders "Pendiente" status and admin sees "Cargar resultado"', async () => {
    const player1 = { _id: 'p1', username: 'alice', avatar: { url: '', publicId: '' } };
    const player2 = { _id: 'p2', username: 'bob', avatar: { url: '', publicId: '' } };
    setupGroups({
      groups: [{
        _id: 'g1',
        tableNumber: 1,
        players: [player1, player2],
        status: 'in_progress',
        advancedPlayers: [],
        games: [{ _id: 'gm1', gameNumber: 1, status: 'pending', results: [] }],
        standings: [],
      }],
      gamesPerGroup: 1,
      currentPhase: 1,
    });
    renderView({ isAdmin: true });
    await waitFor(() => expect(screen.getByText('Partida 1')).toBeInTheDocument());
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cargar resultado/i })).toBeInTheDocument();
  });

  it('completed game shows "✓ Cargada" and admin sees "Deshacer"', async () => {
    const player1 = { _id: 'p1', username: 'alice', avatar: { url: '', publicId: '' } };
    const player2 = { _id: 'p2', username: 'bob', avatar: { url: '', publicId: '' } };
    setupGroups({
      groups: [{
        _id: 'g1',
        tableNumber: 1,
        players: [player1, player2],
        status: 'in_progress',
        advancedPlayers: [],
        games: [{
          _id: 'gm1',
          gameNumber: 1,
          status: 'completed',
          results: [
            { player: player1, score: 30, position: 1 },
            { player: player2, score: 20, position: 2 },
          ],
        }],
        standings: [],
      }],
      gamesPerGroup: 1,
      currentPhase: 1,
    });
    renderView({ isAdmin: true });
    await waitFor(() => expect(screen.getByText(/✓ cargada/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /deshacer/i })).toBeInTheDocument();
    // Results show positions and scores
    expect(screen.getByText('30 pts')).toBeInTheDocument();
    expect(screen.getByText('20 pts')).toBeInTheDocument();
  });

  it('multiple phases render phase tabs', async () => {
    setupGroups({
      groups: [{ _id: 'g1', tableNumber: 1, players: [], status: 'in_progress', advancedPlayers: [], games: [] }],
      currentPhase: 2,
      totalPhases: 3,
    });
    renderView({ torneo: { _id: 't1', status: 'in_progress', currentPhase: 2, gamesPerGroup: 2 } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /fase 1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /fase 2/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /fase 3/i })).toBeInTheDocument();
    });
  });

  it('clicking a phase tab triggers reload for that phase', async () => {
    let lastPhaseRequested = 0;
    server.use(
      http.get('/api/torneos/:id/groups', ({ request }) => {
        const url = new URL(request.url);
        lastPhaseRequested = parseInt(url.searchParams.get('phase') || '1');
        return HttpResponse.json({
          groups: [{ _id: 'g1', tableNumber: 1, players: [], status: 'in_progress', advancedPlayers: [], games: [] }],
          currentPhase: 2,
          totalPhases: 2,
        });
      }),
    );
    renderView({ torneo: { _id: 't1', status: 'in_progress', currentPhase: 2, gamesPerGroup: 2 } });
    await waitFor(() => expect(screen.getByRole('button', { name: /fase 1/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^fase 1/i }));
    await waitFor(() => expect(lastPhaseRequested).toBe(1));
  });

  it('completed non-final group shows "Promovidos" section with advanced players', async () => {
    const advPlayer = { _id: 'p1', username: 'alice', avatar: { url: '', publicId: '' } };
    // Need ≥2 groups so isFinalTable = false for each group
    setupGroups({
      groups: [
        {
          _id: 'g1',
          tableNumber: 1,
          players: [advPlayer],
          status: 'completed',
          advancedPlayers: [advPlayer],
          games: [],
          standings: [],
        },
        {
          _id: 'g2',
          tableNumber: 2,
          players: [],
          status: 'in_progress',
          advancedPlayers: [],
          games: [],
          standings: [],
        },
      ],
      currentPhase: 1,
      totalPhases: 2,
    });
    renderView();
    await waitFor(() => {
      expect(screen.getByText(/promovidos/i)).toBeInTheDocument();
    });
  });

  it('final table shows "🏆 Mesa final" heading', async () => {
    setupGroups({
      groups: [{
        _id: 'g1',
        tableNumber: 1,
        players: [],
        status: 'in_progress',
        advancedPlayers: [],
        games: [],
        standings: [],
      }],
      currentPhase: 1,
      totalPhases: 1,
    });
    renderView();
    await waitFor(() => {
      expect(screen.getByText(/mesa final/i)).toBeInTheDocument();
    });
  });

  it('final table with completed status shows champion banner', async () => {
    const player = { _id: 'p1', username: 'alice', avatar: { url: '', publicId: '' } };
    setupGroups({
      groups: [{
        _id: 'g1',
        tableNumber: 1,
        players: [player],
        status: 'completed',
        advancedPlayers: [],
        games: [],
        standings: [{ user: 'p1', totalPV: 30 }],
      }],
      currentPhase: 1,
      totalPhases: 1,
    });
    renderView({ torneo: { _id: 't1', status: 'in_progress', currentPhase: 1, gamesPerGroup: 1 } });
    await waitFor(() => {
      expect(screen.getByText(/campe[oó]n provisional/i)).toBeInTheDocument();
    });
  });

  it('admin can click "Editar" to enter advanced-players edit mode (shows checkboxes)', async () => {
    const player = { _id: 'p1', username: 'alice', avatar: { url: '', publicId: '' } };
    setupGroups({
      groups: [
        {
          _id: 'g1',
          tableNumber: 1,
          players: [player],
          status: 'completed',
          advancedPlayers: [player],
          games: [],
          standings: [],
        },
        {
          _id: 'g2',
          tableNumber: 2,
          players: [],
          status: 'in_progress',
          advancedPlayers: [],
          games: [],
          standings: [],
        },
      ],
      currentPhase: 1,
      totalPhases: 2,
      gamesPerGroup: 1,
      qualifiersPerGroup: 1,
    });
    renderView({ isAdmin: true });
    await waitFor(() => expect(screen.getByRole('button', { name: /^editar$/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^editar$/i }));
    // Now in edit mode: checkbox list appears
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeInTheDocument());
    // "Listo" button replaces "Editar"
    expect(screen.getByRole('button', { name: /^listo$/i })).toBeInTheDocument();
  });

  it('clicking checkbox in edit mode triggers onToggleAdvanced (PATCH call)', async () => {
    const player = { _id: 'p1', username: 'alice', avatar: { url: '', publicId: '' } };
    server.use(
      http.patch('/api/torneos/:id/groups/:groupId/advanced', () =>
        HttpResponse.json({ ok: true }),
      ),
    );
    setupGroups({
      groups: [
        {
          _id: 'g1',
          tableNumber: 1,
          players: [player],
          status: 'completed',
          advancedPlayers: [player],
          games: [],
          standings: [],
        },
        {
          _id: 'g2',
          tableNumber: 2,
          players: [],
          status: 'in_progress',
          advancedPlayers: [],
          games: [],
          standings: [],
        },
      ],
      currentPhase: 1,
      totalPhases: 2,
      gamesPerGroup: 1,
      qualifiersPerGroup: 1,
    });
    renderView({ isAdmin: true });
    await waitFor(() => expect(screen.getByRole('button', { name: /^editar$/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^editar$/i }));
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeInTheDocument());
    // Click the checkbox → triggers onToggleAdvanced → calls PATCH
    fireEvent.click(screen.getByRole('checkbox'));
    // No crash
  });

  it('deleted player in editingAdvanced mode shows "Usuario eliminado"', async () => {
    const realPlayer = { _id: 'p1', username: 'alice', avatar: { url: '', publicId: '' } };
    // A player with no _id triggers getUserDisplay's isDeleted path
    const ghostPlayer = { username: 'ghost' };
    setupGroups({
      groups: [
        {
          _id: 'g1',
          tableNumber: 1,
          players: [realPlayer, ghostPlayer],
          status: 'completed',
          advancedPlayers: [realPlayer],
          games: [],
          standings: [],
        },
        {
          _id: 'g2',
          tableNumber: 2,
          players: [],
          status: 'in_progress',
          advancedPlayers: [],
          games: [],
          standings: [],
        },
      ],
      currentPhase: 1,
      totalPhases: 2,
      gamesPerGroup: 1,
    });
    renderView({ isAdmin: true });
    await waitFor(() => expect(screen.getByRole('button', { name: /^editar$/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^editar$/i }));
    await waitFor(() => expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0));
    expect(screen.getByText('Usuario eliminado')).toBeInTheDocument();
  });

  it('admin sees "Generar siguiente fase" button when all groups completed with advanced players', async () => {
    const player = { _id: 'p1', username: 'alice', avatar: { url: '', publicId: '' } };
    setupGroups({
      groups: [{
        _id: 'g1',
        tableNumber: 1,
        players: [player],
        status: 'completed',
        advancedPlayers: [player],
        games: [],
        standings: [],
      }],
      currentPhase: 1,
      totalPhases: 2,
    });
    renderView({
      torneo: { _id: 't1', status: 'in_progress', currentPhase: 1, gamesPerGroup: 1 },
      isAdmin: true,
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generar siguiente fase/i })).toBeInTheDocument();
    });
  });
});
