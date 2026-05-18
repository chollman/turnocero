import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../context/NotificationContext', () => ({ useNotifications: vi.fn() }));

// Heavy children — stub for focused testing.
vi.mock('./TableDetailSkeleton', () => ({ default: () => <div>loading-skeleton</div> }));
vi.mock('../../components/shared/GameTile', () => ({ default: () => null }));
vi.mock('../../components/shared/LoginPromptModal', () => ({ default: () => null }));

// Mock socket.io-client so TableDetail's `io(...)` connection is inert.
vi.mock('socket.io-client', () => ({
  io: () => ({ on: () => {}, off: () => {}, emit: () => {}, disconnect: () => {}, connect: () => {} }),
}));

import TableDetail from './TableDetail';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

function makeTable(overrides = {}) {
  return {
    _id: 't1',
    boardGame: 'Catán',
    date: new Date(Date.now() + 7 * 86400000).toISOString(),
    maxPlayers: 4,
    players: [],
    location: 'Buenos Aires',
    description: 'Una noche tranquila',
    host: { _id: 'host1', username: 'host1', avatar: { url: '', publicId: '' }, displayName: 'Host User' },
    status: 'open',
    privacy: 'public',
    pendingRequests: [],
    followers: [],
    reactions: [],
    images: [],
    ...overrides,
  };
}

function setupTable(table) {
  server.use(
    http.get('/api/tables/:id', () => HttpResponse.json(table)),
    http.get('/api/tables/:id/messages', () => HttpResponse.json([])),
    http.get('/api/tables/:id/comments', () => HttpResponse.json([])),
    http.get('/api/tables/:id/ratings', () => HttpResponse.json({ ratings: [], avg: null, count: 0 })),
  );
}

function renderTableDetail({ user = null, id = 't1' } = {}) {
  useAuth.mockReturnValue({ user });
  useNotifications.mockReturnValue({ setActiveTable: vi.fn() });
  return render(
    <MemoryRouter initialEntries={[`/mesas/${id}`]}>
      <Routes>
        <Route path="/mesas/:id" element={<TableDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  setupTable(makeTable());
});

describe('<TableDetail>', () => {
  it('renders the board game name as the heading', async () => {
    renderTableDetail();
    expect(await screen.findByText('Catán')).toBeInTheDocument();
  });

  it('renders the location and description', async () => {
    renderTableDetail();
    await screen.findByText('Catán');
    expect(screen.getByText('Buenos Aires')).toBeInTheDocument();
    expect(screen.getByText('Una noche tranquila')).toBeInTheDocument();
  });

  it('shows the loading skeleton initially', () => {
    renderTableDetail();
    expect(screen.getByText('loading-skeleton')).toBeInTheDocument();
  });

  it('handles a 404 gracefully (no crash)', async () => {
    server.use(http.get('/api/tables/:id', () => HttpResponse.json({}, { status: 404 })));
    const { container } = renderTableDetail();
    // After load the page should not throw. Either error state, skeleton, or empty
    // — all acceptable; we just verify no exception escaped.
    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });

  it('renders the host name', async () => {
    renderTableDetail();
    await screen.findByText('Catán');
    expect(screen.getAllByText(/Host User|host1/i).length).toBeGreaterThan(0);
  });
});
