import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GameScoreModal from './GameScoreModal';

const PLAYERS = [
  { _id: 'p1', username: 'alice', avatar: { url: '', publicId: '' } },
  { _id: 'p2', username: 'bob', avatar: { url: '', publicId: '' } },
  { _id: 'p3', username: 'carol', avatar: { url: '', publicId: '' } },
];

function renderModal({
  game = { _id: 'g1', gameNumber: 1, results: [] },
  players = PLAYERS,
  onClose = vi.fn(),
  onConfirm = vi.fn(),
} = {}) {
  return render(
    <MemoryRouter>
      <GameScoreModal game={game} players={players} onClose={onClose} onConfirm={onConfirm} />
    </MemoryRouter>,
  );
}

describe('<GameScoreModal>', () => {
  it('renders one score row per player', () => {
    renderModal();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('carol')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('Score')).toHaveLength(3);
  });

  it('shows the game number in the title', () => {
    renderModal({ game: { _id: 'g1', gameNumber: 3, results: [] } });
    expect(screen.getByText(/partida 3/i)).toBeInTheDocument();
  });

  it('pre-fills scores from existing results', () => {
    renderModal({
      game: {
        _id: 'g1',
        gameNumber: 1,
        results: [
          { player: { _id: 'p1' }, score: 10 },
          { player: { _id: 'p2' }, score: 7 },
          { player: { _id: 'p3' }, score: 4 },
        ],
      },
    });
    const inputs = screen.getAllByPlaceholderText('Score');
    expect(inputs[0].value).toBe('10');
    expect(inputs[1].value).toBe('7');
    expect(inputs[2].value).toBe('4');
  });

  it('typing scores updates the displayed position dynamically', () => {
    renderModal();
    const inputs = screen.getAllByPlaceholderText('Score');
    fireEvent.change(inputs[0], { target: { value: '5' } });   // alice
    fireEvent.change(inputs[1], { target: { value: '10' } });  // bob (winner)
    fireEvent.change(inputs[2], { target: { value: '3' } });   // carol
    // Bob should be 1º, alice 2º, carol 3º
    expect(screen.getByText('1º')).toBeInTheDocument();
    expect(screen.getByText('2º')).toBeInTheDocument();
    expect(screen.getByText('3º')).toBeInTheDocument();
  });

  it('shows validation error if any score is missing', () => {
    renderModal();
    const inputs = screen.getAllByPlaceholderText('Score');
    fireEvent.change(inputs[0], { target: { value: '5' } });
    // leave others empty
    fireEvent.click(screen.getByRole('button', { name: /guardar resultado/i }));
    expect(screen.getByText(/score numérico para cada jugador/i)).toBeInTheDocument();
  });

  it('on submit with all scores calls onConfirm with results', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderModal({ onConfirm });
    const inputs = screen.getAllByPlaceholderText('Score');
    fireEvent.change(inputs[0], { target: { value: '10' } });
    fireEvent.change(inputs[1], { target: { value: '7' } });
    fireEvent.change(inputs[2], { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar resultado/i }));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        results: [
          { playerId: 'p1', score: 10 },
          { playerId: 'p2', score: 7 },
          { playerId: 'p3', score: 4 },
        ],
      });
    });
  });

  it('Cancel calls onClose', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
