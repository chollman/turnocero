import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../components/shared/Avatar', () => ({
  default: ({ user }) => <div data-testid="avatar">{user?.username || ''}</div>,
}));
vi.mock('../../components/shared/ModalPortal', () => ({
  default: ({ children }) => <div data-testid="modal-portal">{children}</div>,
}));

import PlayDetailModal from './PlayDetailModal';

function makePlay(overrides = {}) {
  return {
    id: 'p1',
    gameId: '13',
    gameName: 'Catán',
    gameThumbnail: 'https://cdn/catan.jpg',
    date: '2026-05-01',
    location: 'Buenos Aires',
    duration: 90,
    quantity: 1,
    incomplete: false,
    nowinstats: false,
    comments: '',
    players: [
      { name: 'Alice', username: 'alice', color: 'red', score: '10', rating: 7.5, win: true, position: 1, new: false },
      { name: 'Bob', username: 'bob', color: '', score: '7', rating: null, win: false, position: 2, new: true },
    ],
    ...overrides,
  };
}

function renderModal(props = {}) {
  return render(
    <MemoryRouter>
      <PlayDetailModal play={makePlay(props.play)} userMap={props.userMap || {}} onClose={props.onClose || vi.fn()} />
    </MemoryRouter>,
  );
}

describe('<PlayDetailModal>', () => {
  it('returns null when play is null', () => {
    const { container } = render(<PlayDetailModal play={null} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the game name and BGG link', () => {
    renderModal();
    expect(screen.getByText('Catán')).toBeInTheDocument();
    const bggLink = screen.getByRole('link', { name: /ver en boardgamegeek/i });
    expect(bggLink).toHaveAttribute('href', 'https://boardgamegeek.com/boardgame/13');
  });

  it('renders all players in a table with scores and ratings', () => {
    renderModal();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('7.5')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('renders "—" instead of "null" when a player has no score', () => {
    renderModal({
      play: {
        players: [
          { name: 'NoScore', username: 'ns', score: null, win: false, position: 1, new: false, rating: null },
          { name: 'PoisonedScore', username: 'ps', score: 'null', win: false, position: 2, new: false, rating: null },
        ],
      },
    });
    expect(screen.getByText('NoScore')).toBeInTheDocument();
    expect(screen.getByText('PoisonedScore')).toBeInTheDocument();
    // No literal "null" text in the score column.
    expect(screen.queryByText(/^null$/i)).toBeNull();
  });

  it('shows the "nuevo" badge on new players', () => {
    renderModal();
    expect(screen.getByText('nuevo')).toBeInTheDocument();
  });

  it('renders details section with location and duration', () => {
    renderModal();
    expect(screen.getByText('Ubicación')).toBeInTheDocument();
    expect(screen.getByText('Buenos Aires')).toBeInTheDocument();
    expect(screen.getByText('Duración')).toBeInTheDocument();
    expect(screen.getByText('90 min')).toBeInTheDocument();
  });

  it('renders comments section when comments present', () => {
    renderModal({ play: { comments: 'Great game!' } });
    expect(screen.getByText('Great game!')).toBeInTheDocument();
  });

  it('calls onClose when clicking the close icon', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByLabelText('Cerrar'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking the "Cerrar" footer button', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    // Two "Cerrar" buttons exist: close icon and footer. The footer one is the last.
    const buttons = screen.getAllByRole('button', { name: 'Cerrar' });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('links to /usuarios/:id when the player is a Turnocero member', () => {
    renderModal({ userMap: { alice: { _id: 'u1', username: 'alice', displayName: 'Alice T' } } });
    const link = screen.getByRole('link', { name: /@alice · en turnocero/i });
    expect(link).toHaveAttribute('href', '/usuarios/u1');
  });

  it('links to BGG user profile when player is NOT a Turnocero member', () => {
    renderModal();
    const link = screen.getByRole('link', { name: /@alice/i });
    expect(link).toHaveAttribute('href', 'https://boardgamegeek.com/user/alice');
  });
});
