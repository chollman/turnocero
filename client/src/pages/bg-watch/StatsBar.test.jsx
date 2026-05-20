import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatsBar from './StatsBar';

describe('<StatsBar>', () => {
  it('renders all four metric labels with em-dashes when there is no data', () => {
    render(<StatsBar collection={null} playsMeta={null} />);
    expect(screen.getByText('Partidas')).toBeInTheDocument();
    expect(screen.getByText(/juegos únicos/i)).toBeInTheDocument();
    expect(screen.getByText(/más jugado/i)).toBeInTheDocument();
    expect(screen.getByText(/última partida/i)).toBeInTheDocument();
  });

  it('uses topGame from playsMeta (plays-log aggregation) when present', () => {
    const playsMeta = {
      total: 42,
      lastDate: '2026-05-01',
      topGame: { id: '13', name: 'Brass: Birmingham', thumbnail: 'b.jpg', numPlays: 9 },
    };
    // Collection has a different "leader" — playsMeta should win.
    const collection = [
      { id: 7, name: 'Catán', numPlays: 99 },
    ];
    render(<StatsBar collection={collection} playsMeta={playsMeta} />);
    expect(screen.getByText('Brass: Birmingham')).toBeInTheDocument();
    expect(screen.getByText(/9× partidas/)).toBeInTheDocument();
    expect(screen.queryByText('Catán')).not.toBeInTheDocument();
  });

  it('falls back to the collection-derived top game when playsMeta has no topGame', () => {
    const playsMeta = { total: 5, lastDate: '2026-05-01' }; // no topGame field
    const collection = [
      { id: 7, name: 'Catán', numPlays: 3 },
      { id: 8, name: 'Carcassonne', numPlays: 7 },
    ];
    render(<StatsBar collection={collection} playsMeta={playsMeta} />);
    expect(screen.getByText('Carcassonne')).toBeInTheDocument();
    expect(screen.getByText(/7× partidas/)).toBeInTheDocument();
  });

  it('falls back when playsMeta.topGame is explicitly null', () => {
    const playsMeta = { total: 5, lastDate: '2026-05-01', topGame: null };
    const collection = [
      { id: 7, name: 'Catán', numPlays: 4 },
    ];
    render(<StatsBar collection={collection} playsMeta={playsMeta} />);
    expect(screen.getByText('Catán')).toBeInTheDocument();
    expect(screen.getByText(/4× partidas/)).toBeInTheDocument();
  });

  it('shows em-dash for "Más jugado" when neither source has a winner', () => {
    const playsMeta = { total: 0, lastDate: null, topGame: null };
    const collection = [{ id: 7, name: 'Catán', numPlays: 0 }];
    render(<StatsBar collection={collection} playsMeta={playsMeta} />);
    // The "Más jugado" card should render '—'
    const masJugadoLabel = screen.getByText(/más jugado/i);
    const card = masJugadoLabel.parentElement;
    expect(card.textContent).toMatch(/—/);
    expect(card.textContent).not.toMatch(/× partidas/);
  });

  it('renders totalPartidas and formatted lastDate', () => {
    const playsMeta = { total: 17, lastDate: '2026-05-15', topGame: null };
    render(<StatsBar collection={[]} playsMeta={playsMeta} />);
    expect(screen.getByText('17')).toBeInTheDocument();
    // Spanish AR locale, day + short month + year
    expect(screen.getByText(/15.*may.*2026/i)).toBeInTheDocument();
  });
});
