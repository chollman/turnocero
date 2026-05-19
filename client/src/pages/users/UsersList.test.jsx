import { describe, it, expect, vi } from 'vitest';
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

  it('shows banned badge on a banned user', async () => {
    setup({
      currentUser: { _id: 'admin', isAdmin: true },
      users: [makeUserCard({ username: 'badguy', isBanned: true })],
    });
    await screen.findByText('@badguy');
    expect(screen.getByText('Baneado')).toBeInTheDocument();
  });

  it('regular user cannot see banned users (filtered client-side)', async () => {
    setup({
      currentUser: { _id: 'me', isAdmin: false },
      users: [
        makeUserCard({ _id: 'b1', username: 'badguy', isBanned: true }),
        makeUserCard({ _id: 'g1', username: 'goodguy', isBanned: false }),
      ],
    });
    await screen.findByText('@goodguy');
    expect(screen.queryByText('@badguy')).not.toBeInTheDocument();
  });

  it('user with displayName shows it below the username', async () => {
    setup({
      users: [makeUserCard({ username: 'alice123', displayName: 'Alice García' })],
    });
    await screen.findByText('@alice123');
    expect(screen.getByText('Alice García')).toBeInTheDocument();
  });

  it('user with bggUsername shows a BG Watch chip link', async () => {
    // Set bggUsername on currentUser to suppress the BG Watch banner (which is also a link with "BG Watch" text)
    setup({
      currentUser: { _id: 'me', isAdmin: false, bggUsername: 'me_bgg' },
      users: [makeUserCard({ username: 'alice', bggUsername: 'alice_bgg' })],
    });
    await screen.findByText('@alice');
    expect(screen.getByRole('link', { name: 'BG Watch' })).toBeInTheDocument();
  });

  it('shows BG Watch banner when logged-in user has no bggUsername', async () => {
    setup({
      currentUser: { _id: 'me', isAdmin: false },
      users: [makeUserCard({ username: 'alice' })],
    });
    await screen.findByText('@alice');
    expect(screen.getByText(/ya conocés bg watch/i)).toBeInTheDocument();
  });

  it('BG Watch banner is hidden when user already has bggUsername', async () => {
    setup({
      currentUser: { _id: 'me', isAdmin: false, bggUsername: 'myname' },
      users: [makeUserCard({ username: 'alice' })],
    });
    await screen.findByText('@alice');
    expect(screen.queryByText(/ya conocés bg watch/i)).not.toBeInTheDocument();
  });

  it('shows search input and typing updates its value', async () => {
    setup({ users: [makeUserCard({ username: 'alice' })] });
    await screen.findByText('@alice');
    const input = screen.getByPlaceholderText(/buscar por usuario/i);
    fireEvent.change(input, { target: { value: 'test' } });
    expect(input.value).toBe('test');
    // Clear button appears
    expect(screen.getByRole('button', { name: '✕' })).toBeInTheDocument();
  });

  it('clicking ✕ in search clears the search input', async () => {
    setup({ users: [makeUserCard({ username: 'alice' })] });
    await screen.findByText('@alice');
    const input = screen.getByPlaceholderText(/buscar por usuario/i);
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    expect(input.value).toBe('');
  });

  it('shows filter toggle buttons (Solo activos / Solo amigos / Con BG Watch)', async () => {
    setup({ users: [makeUserCard({ username: 'alice' })] });
    await screen.findByText('@alice');
    expect(screen.getByRole('button', { name: /solo activos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /solo amigos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /con bg watch/i })).toBeInTheDocument();
  });

  it('shows sort select with all sort options', async () => {
    setup({ users: [makeUserCard({ username: 'alice' })] });
    await screen.findByText('@alice');
    expect(screen.getByRole('option', { name: 'A–Z' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Más activos' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Más nuevos' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Más antiguos' })).toBeInTheDocument();
  });

  it('shows empty state message when no users are returned', async () => {
    setup({ users: [] });
    await waitFor(() => {
      expect(screen.getByText(/no se encontraron jugadores/i)).toBeInTheDocument();
    });
  });

  it('admin clicking Banear opens the ban confirmation modal', async () => {
    setup({
      currentUser: { _id: 'admin', isAdmin: true, username: 'admin' },
      users: [
        makeUserCard({ _id: 'admin', username: 'admin' }),
        makeUserCard({ _id: 'other', username: 'alice' }),
      ],
    });
    await screen.findByText('@alice');
    fireEvent.click(screen.getByRole('button', { name: /^banear$/i }));
    await waitFor(() =>
      expect(screen.getByText(/banear usuario/i)).toBeInTheDocument(),
    );
    // Modal has a confirm button labeled "Banear"
    const confirmBtns = screen.getAllByRole('button', { name: /^banear$/i });
    expect(confirmBtns.length).toBeGreaterThan(0);
  });

  it('admin confirming ban calls PATCH and updates user as banned', async () => {
    server.use(
      http.patch('/api/admin/users/:id/ban', () =>
        HttpResponse.json({ isBanned: true, bannedAt: new Date().toISOString(), bannedReason: '' }),
      ),
    );
    setup({
      currentUser: { _id: 'admin', isAdmin: true, username: 'admin' },
      users: [
        makeUserCard({ _id: 'admin', username: 'admin' }),
        makeUserCard({ _id: 'other', username: 'alice', isBanned: false }),
      ],
    });
    await screen.findByText('@alice');
    // Click the "Banear" button on alice's card
    fireEvent.click(screen.getByRole('button', { name: /^banear$/i }));
    await waitFor(() => expect(screen.getByText(/banear usuario/i)).toBeInTheDocument());
    // Confirm in the modal (the modal confirm button)
    const confirmBtns = screen.getAllByRole('button', { name: /^banear$/i });
    // Click the last one (inside the modal)
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    await waitFor(() => expect(screen.getByText('Baneado')).toBeInTheDocument());
  });

  it('admin clicking Eliminar opens the delete confirmation modal', async () => {
    setup({
      currentUser: { _id: 'admin', isAdmin: true, username: 'admin' },
      users: [
        makeUserCard({ _id: 'admin', username: 'admin' }),
        makeUserCard({ _id: 'other', username: 'alice' }),
      ],
    });
    await screen.findByText('@alice');
    // Use exact name to avoid matching the outer card's role="button" which also contains "Eliminar"
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() =>
      expect(screen.getByText(/eliminar usuario/i)).toBeInTheDocument(),
    );
  });

  it('admin confirming delete calls DELETE and removes user from list', async () => {
    server.use(
      http.delete('/api/admin/users/:id', () => HttpResponse.json({ ok: true })),
    );
    setup({
      currentUser: { _id: 'admin', isAdmin: true, username: 'admin' },
      users: [
        makeUserCard({ _id: 'admin', username: 'admin' }),
        makeUserCard({ _id: 'other', username: 'alice', isBanned: false }),
      ],
    });
    await screen.findByText('@alice');
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(screen.getByText(/eliminar usuario/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));
    await waitFor(() => expect(screen.queryByText('@alice')).not.toBeInTheDocument());
  });

  it('admin badge shown for other admin users (not self)', async () => {
    setup({
      currentUser: { _id: 'me', isAdmin: false },
      users: [makeUserCard({ _id: 'other-admin', username: 'superadmin', isAdmin: true })],
    });
    await screen.findByText('@superadmin');
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });
});
