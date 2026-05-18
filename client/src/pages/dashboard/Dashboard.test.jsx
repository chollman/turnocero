import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

// TableCard is exercised in TableCard.test.jsx (or stubbed here to avoid pulling in
// dozens of child components — keep this test focused on Dashboard logic).
vi.mock('./TableCard', () => ({
  default: ({ table }) => (
    <div data-testid="table-card">{table.boardGame} · host: {table.host?.username}</div>
  ),
}));

import Dashboard from './Dashboard';
import { useAuth } from '../../context/AuthContext';

function makeTable(overrides = {}) {
  return {
    _id: overrides._id || `t${Math.random()}`,
    boardGame: overrides.boardGame || 'Catán',
    date: overrides.date || new Date(Date.now() + 7 * 86400000).toISOString(),
    maxPlayers: overrides.maxPlayers ?? 4,
    players: overrides.players || [],
    location: overrides.location || 'BA',
    host: overrides.host || { _id: 'host1', username: 'host', avatar: { url: '', publicId: '' } },
    status: overrides.status || 'open',
    privacy: overrides.privacy || 'public',
    ...overrides,
  };
}

beforeEach(() => {
  useAuth.mockReturnValue({ user: { _id: 'me', username: 'me' } });
  server.use(
    http.get('/api/tables', () =>
      HttpResponse.json({
        tables: [makeTable({ boardGame: 'Wingspan' }), makeTable({ boardGame: 'Carcassonne' })],
        page: 1,
        pages: 1,
        total: 2,
      }),
    ),
    http.get('/api/tables/mine', () =>
      HttpResponse.json({
        tables: [makeTable({ boardGame: 'MyOwnGame' })],
        page: 1,
        pages: 1,
        total: 1,
      }),
    ),
  );
});

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

describe('<Dashboard>', () => {
  it('renders the loading skeleton initially and then the table list', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getAllByTestId('table-card')).toHaveLength(2);
    });
    expect(screen.getByText(/Wingspan/)).toBeInTheDocument();
    expect(screen.getByText(/Carcassonne/)).toBeInTheDocument();
  });

  it('shows the total count from the API in the eyebrow', async () => {
    renderDashboard();
    // The eyebrow is duplicated in mobile header + desktop hero. Both should contain the count.
    await waitFor(() => {
      const eyebrows = screen.getAllByText((_content, el) =>
        el?.tagName === 'P' && /MESAS ACTIVAS/i.test(el.textContent),
      );
      expect(eyebrows.length).toBeGreaterThan(0);
      eyebrows.forEach((eb) => expect(eb.textContent).toMatch(/2/));
    });
  });

  it('clicking "Mis mesas" switches to the /mine endpoint', async () => {
    renderDashboard();
    await screen.findByText(/Wingspan/);
    fireEvent.click(screen.getByRole('button', { name: /mis mesas/i }));
    await waitFor(() => expect(screen.getByText(/MyOwnGame/)).toBeInTheDocument());
  });

  it('shows an error message when the API fails', async () => {
    server.use(http.get('/api/tables', () => HttpResponse.json({}, { status: 500 })));
    renderDashboard();
    expect(await screen.findByText(/Error al cargar las mesas/i)).toBeInTheDocument();
  });
});
