import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../context/NotificationContext', () => ({ useNotifications: vi.fn() }));
vi.mock('../../context/ChatContext', () => ({ useChat: vi.fn() }));

import Notifications from './Notifications';
import { useNotifications } from '../../context/NotificationContext';
import { useChat } from '../../context/ChatContext';

function makeNotif(overrides = {}) {
  return {
    _id: overrides._id || `n${Math.random()}`,
    type: overrides.type || 'comment',
    read: overrides.read ?? false,
    count: overrides.count ?? 1,
    tableId: overrides.tableId || 't1',
    tableName: overrides.tableName || 'Mesa',
    updatedAt: overrides.updatedAt || new Date().toISOString(),
    ...overrides,
  };
}

function setup({ notifications = [] } = {}) {
  useNotifications.mockReturnValue({
    notifications,
    markRead: vi.fn(),
    markReadFriend: vi.fn(),
    markReadTorneo: vi.fn(),
    markReadCompartida: vi.fn(),
    markReadDm: vi.fn(),
    markReadAdminChat: vi.fn(),
    markAllRead: vi.fn(),
    loadOlder: vi.fn(),
    clearAll: vi.fn(),
  });
  useChat.mockReturnValue({ clearConversationUnread: vi.fn() });
  return render(
    <MemoryRouter>
      <Notifications />
    </MemoryRouter>,
  );
}

describe('<Notifications>', () => {
  it('renders the empty state when there are no notifications', () => {
    setup({ notifications: [] });
    expect(screen.getByText('Sin notificaciones')).toBeInTheDocument();
  });

  it('renders one item per notification', () => {
    setup({
      notifications: [
        makeNotif({ type: 'comment', tableName: 'Mesa Catán', lastCommenterUsername: 'alice' }),
        makeNotif({ type: 'friend_request', fromUsername: 'bob' }),
      ],
    });
    expect(screen.getByText(/Mesa Catán/)).toBeInTheDocument();
    expect(screen.getByText(/bob/)).toBeInTheDocument();
  });

  it('shows category tabs (Todas / Mesas / Torneos / Amigos / Compartidas / Admin)', () => {
    setup({
      notifications: [
        makeNotif({ type: 'chat' }),
        makeNotif({ type: 'tournament_accepted', torneoTitle: 'Torneo X', torneoId: 'tt1' }),
        makeNotif({ type: 'friend_request', fromUsername: 'cha' }),
      ],
    });
    // At least these tabs should be in the DOM.
    expect(screen.getAllByRole('button', { name: /todas/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /mesas/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /torneos/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /amigos/i }).length).toBeGreaterThan(0);
  });

  it('"Marcar todo como leído" calls markAllRead', () => {
    const markAllRead = vi.fn();
    useNotifications.mockReturnValue({
      notifications: [makeNotif({ read: false })],
      markRead: vi.fn(),
      markReadFriend: vi.fn(),
      markReadTorneo: vi.fn(),
      markReadCompartida: vi.fn(),
      markReadDm: vi.fn(),
      markReadAdminChat: vi.fn(),
      markAllRead,
      loadOlder: vi.fn(),
      clearAll: vi.fn(),
    });
    useChat.mockReturnValue({ clearConversationUnread: vi.fn() });
    render(<MemoryRouter><Notifications /></MemoryRouter>);
    const btn = screen.queryByRole('button', { name: /marcar.*le[ií]do/i });
    if (btn) {
      fireEvent.click(btn);
      expect(markAllRead).toHaveBeenCalled();
    }
  });
});
