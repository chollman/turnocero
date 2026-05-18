import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
});
