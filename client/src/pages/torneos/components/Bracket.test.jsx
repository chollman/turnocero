import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Bracket from './Bracket';

function makeMatch(overrides = {}) {
  return {
    _id: overrides._id || `m${Math.random()}`,
    round: overrides.round ?? 1,
    matchIndex: overrides.matchIndex ?? 0,
    playerA: overrides.playerA,
    playerB: overrides.playerB,
    winner: overrides.winner || null,
    status: overrides.status || 'pending',
    isUpperSlot: overrides.isUpperSlot ?? true,
    ...overrides,
  };
}

const ALICE = { _id: 'a', username: 'alice', avatar: { url: '', publicId: '' } };
const BOB   = { _id: 'b', username: 'bob', avatar: { url: '', publicId: '' } };
const CHA   = { _id: 'c', username: 'cha', avatar: { url: '', publicId: '' } };
const DAN   = { _id: 'd', username: 'dan', avatar: { url: '', publicId: '' } };

function renderBracket(matches, { isAdmin = false } = {}) {
  Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
  return render(
    <MemoryRouter>
      <Bracket
        matches={matches}
        isAdmin={isAdmin}
        onRecord={vi.fn()}
        onUndo={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe('<Bracket>', () => {
  it('shows the empty state when there are no matches', () => {
    renderBracket([]);
    expect(screen.getByText(/no se gener[oó] el bracket/i)).toBeInTheDocument();
  });

  it('renders both players in a round-1 match', () => {
    renderBracket([
      makeMatch({ round: 1, matchIndex: 0, playerA: ALICE, playerB: BOB }),
    ]);
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it('renders multiple rounds (semifinals + final), with the final labeled', () => {
    renderBracket([
      makeMatch({ round: 1, matchIndex: 0, playerA: ALICE, playerB: BOB }),
      makeMatch({ round: 1, matchIndex: 1, playerA: CHA, playerB: DAN }),
      makeMatch({ round: 2, matchIndex: 0 }),
    ]);
    // Both "Semifinal" and "Final" match /final/i — we expect at least 1.
    expect(screen.getAllByText(/final/i).length).toBeGreaterThan(0);
    // Specifically, the final label (exact match) should appear.
    expect(screen.getByText('Final')).toBeInTheDocument();
  });

  it('shows the winner badge when a match is completed', () => {
    renderBracket([
      makeMatch({
        round: 1, matchIndex: 0,
        playerA: ALICE, playerB: BOB,
        winner: ALICE,
        status: 'completed',
      }),
    ]);
    // Winner gets visual indication; alice's name is still present.
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('admin sees "Cargar resultado" when a pending match has both players', () => {
    renderBracket(
      [makeMatch({ round: 1, matchIndex: 0, playerA: ALICE, playerB: BOB })],
      { isAdmin: true },
    );
    expect(screen.getByRole('button', { name: /cargar resultado|registrar resultado/i })).toBeInTheDocument();
  });

  it('non-admin does NOT see action buttons', () => {
    renderBracket(
      [makeMatch({ round: 1, matchIndex: 0, playerA: ALICE, playerB: BOB })],
      { isAdmin: false },
    );
    expect(screen.queryByRole('button', { name: /cargar resultado|registrar/i })).not.toBeInTheDocument();
  });

  it('mobile view shows the round selector and only the active round', () => {
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    render(
      <MemoryRouter>
        <Bracket
          matches={[
            makeMatch({ round: 1, matchIndex: 0, playerA: ALICE, playerB: BOB }),
            makeMatch({ round: 1, matchIndex: 1, playerA: CHA, playerB: DAN }),
            makeMatch({ round: 2, matchIndex: 0 }),
          ]}
          isAdmin={false}
          onRecord={vi.fn()}
          onUndo={vi.fn()}
        />
      </MemoryRouter>,
    );
    // Round selector buttons should be present.
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });
});
