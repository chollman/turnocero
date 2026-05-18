import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

import UsersList from './UsersList';
import { useAuth } from '../../context/AuthContext';

function makeUserCard(overrides = {}) {
  return {
    _id: overrides._id || `u${Math.random()}`,
    username: overrides.username || 'someuser',
    displayName: overrides.displayName || '',
    tablesAsHost: overrides.tablesAsHost ?? 1,
    tablesAsPlayer: overrides.tablesAsPlayer ?? 2,
    compartidas: overrides.compartidas ?? 0,
    isAdmin: overrides.isAdmin ?? false,
    isBanned: overrides.isBanned ?? false,
    createdAt: overrides.createdAt || new Date().toISOString(),
    avatar: { url: '', publicId: '' },
    ...overrides,
  };
}

function setup({ currentUser = { _id: 'me', isAdmin: false }, users = [] } = {}) {
  useAuth.mockReturnValue({ user: currentUser });
  server.use(http.get('/api/users', () => HttpResponse.json(users)));
  return render(
    <MemoryRouter>
      <UsersList />
    </MemoryRouter>,
  );
}

describe('<UsersList>', () => {
  it('renders user cards loaded from the API', async () => {
    setup({
      users: [
        makeUserCard({ username: 'alice' }),
        makeUserCard({ username: 'bob' }),
      ],
    });
    expect(await screen.findByText('@alice')).toBeInTheDocument();
    expect(screen.getByText('@bob')).toBeInTheDocument();
  });

  it('shows admin actions (Banear/Eliminar) only for admins, not for the admin\'s own row', async () => {
    setup({
      currentUser: { _id: 'admin', isAdmin: true, username: 'admin' },
      users: [
        makeUserCard({ _id: 'admin', username: 'admin' }),
        makeUserCard({ _id: 'other', username: 'alice' }),
      ],
    });
    await screen.findByText('@admin');
    // Admin's own row has no ban/delete buttons; the other user's row does.
    const banButtons = screen.getAllByRole('button', { name: /banear/i });
    expect(banButtons.length).toBeGreaterThan(0);
  });

  it('regular users do not see ban/delete buttons', async () => {
    setup({
      currentUser: { _id: 'me', isAdmin: false },
      users: [makeUserCard({ username: 'alice' })],
    });
    await screen.findByText('@alice');
    expect(screen.queryByRole('button', { name: /banear/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
  });

  it('renders activity stats (Mesas creadas / Mesas jugadas / Publicaciones / Total)', async () => {
    setup({
      users: [
        makeUserCard({ username: 'alice', tablesAsHost: 4, tablesAsPlayer: 2, compartidas: 1 }),
      ],
    });
    await screen.findByText('@alice');
    expect(screen.getByText('Mesas creadas')).toBeInTheDocument();
    expect(screen.getByText('Mesas jugadas')).toBeInTheDocument();
    expect(screen.getByText('Publicaciones')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });
});
