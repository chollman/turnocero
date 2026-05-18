import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LeagueRoundsList from './LeagueRoundsList';

const A = { _id: 'a', username: 'alice', avatar: { url: '', publicId: '' } };
const B = { _id: 'b', username: 'bob', avatar: { url: '', publicId: '' } };

function makeMatch(overrides = {}) {
  return {
    _id: overrides._id || `m${Math.random()}`,
    round: overrides.round ?? 1,
    matchIndex: overrides.matchIndex ?? 0,
    playerA: overrides.playerA ?? A,
    playerB: overrides.playerB ?? B,
    winner: overrides.winner,
    status: overrides.status || 'pending',
    isDraw: overrides.isDraw,
    ...overrides,
  };
}

function renderList({ matches, isAdmin = false, onRecord = vi.fn(), onUndo = vi.fn() } = {}) {
  return render(
    <MemoryRouter>
      <LeagueRoundsList matches={matches} isAdmin={isAdmin} onRecord={onRecord} onUndo={onUndo} />
    </MemoryRouter>,
  );
}

describe('<LeagueRoundsList>', () => {
  it('shows empty state when no matches', () => {
    renderList({ matches: [] });
    expect(screen.getByText(/no se gener[oó] el fixture/i)).toBeInTheDocument();
  });

  it('groups matches by round, labeled "Ronda 1 / Ronda 2 / ..."', () => {
    renderList({
      matches: [
        makeMatch({ round: 1, matchIndex: 0 }),
        makeMatch({ round: 2, matchIndex: 0 }),
        makeMatch({ round: 3, matchIndex: 0 }),
      ],
    });
    expect(screen.getByText('Ronda 1')).toBeInTheDocument();
    expect(screen.getByText('Ronda 2')).toBeInTheDocument();
    expect(screen.getByText('Ronda 3')).toBeInTheDocument();
  });

  it('renders both players and "vs" between them', () => {
    renderList({ matches: [makeMatch()] });
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('vs')).toBeInTheDocument();
  });

  it('shows BYE chip when match status is "bye"', () => {
    renderList({ matches: [makeMatch({ status: 'bye', playerB: null })] });
    expect(screen.getByText('BYE')).toBeInTheDocument();
  });

  it('shows winner checkmark on completed matches', () => {
    renderList({
      matches: [makeMatch({ status: 'completed', winner: A })],
    });
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('shows "empate" tag when isDraw=true', () => {
    renderList({
      matches: [makeMatch({ status: 'completed', isDraw: true })],
    });
    expect(screen.getAllByText('empate').length).toBeGreaterThan(0);
  });

  it('admin sees "Cargar" on pending matches with both players', () => {
    renderList({ matches: [makeMatch()], isAdmin: true });
    expect(screen.getByRole('button', { name: /cargar/i })).toBeInTheDocument();
  });

  it('admin sees "Deshacer" on completed matches', () => {
    renderList({
      matches: [makeMatch({ status: 'completed', winner: A })],
      isAdmin: true,
    });
    expect(screen.getByRole('button', { name: /deshacer/i })).toBeInTheDocument();
  });

  it('non-admin does NOT see Cargar/Deshacer', () => {
    renderList({ matches: [makeMatch()], isAdmin: false });
    expect(screen.queryByRole('button', { name: /cargar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /deshacer/i })).not.toBeInTheDocument();
  });

  it('clicking Cargar calls onRecord with the match', () => {
    const onRecord = vi.fn();
    const match = makeMatch();
    renderList({ matches: [match], isAdmin: true, onRecord });
    fireEvent.click(screen.getByRole('button', { name: /cargar/i }));
    expect(onRecord).toHaveBeenCalledWith(match);
  });
});
