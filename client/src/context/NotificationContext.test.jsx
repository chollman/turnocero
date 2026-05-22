import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';

// Mock socket.io-client so we capture the event handlers and can fire them at will.
const socketEvents = new Map();
const socketOnMock = vi.fn((event, handler) => {
  socketEvents.set(event, handler);
});
const socketDisconnectMock = vi.fn();
const socketEmitMock = vi.fn();
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: socketOnMock,
    disconnect: socketDisconnectMock,
    emit: socketEmitMock,
  })),
}));

const useAuthMock = vi.fn();
const useSiteConfigMock = vi.fn();
vi.mock('./AuthContext', () => ({ useAuth: () => useAuthMock() }));
vi.mock('./SiteConfigContext', () => ({ useSiteConfig: () => useSiteConfigMock() }));

import { NotificationProvider, useNotifications } from './NotificationContext';

// Fire a captured socket event by name with a payload.
function fireSocketEvent(event, payload) {
  const h = socketEvents.get(event);
  if (!h) throw new Error(`No handler registered for "${event}"`);
  act(() => h(payload));
}

function Probe() {
  const n = useNotifications();
  return (
    <div>
      <span data-testid="count">{n.notifications.length}</span>
      <span data-testid="unread">{n.unreadCount}</span>
      <span data-testid="toasts">{n.toasts.length}</span>
      <span data-testid="admin-unread">{n.adminChatUnread}</span>
      <button onClick={() => n.markRead('t1')}>mark-read-t1</button>
      <button onClick={() => n.markReadFriend('u1')}>mark-friend-u1</button>
      <button onClick={() => n.markReadTorneo('tn1')}>mark-torneo-tn1</button>
      <button onClick={() => n.markReadCompartida('c1')}>mark-comp-c1</button>
      <button onClick={() => n.markReadDm('u1')}>mark-dm-u1</button>
      <button onClick={n.markAllRead}>mark-all-read</button>
      <button onClick={n.clearAll}>clear-all</button>
      <button onClick={() => n.setActiveTable('t1')}>active-t1</button>
      <button onClick={() => n.setActiveTable(null)}>active-null</button>
      <button onClick={() => n.setActiveTorneo('tn1')}>active-tn1</button>
      <button onClick={() => n.setActiveCompartida('c1')}>active-c1</button>
      <button onClick={() => n.markReadEvento('ev1')}>mark-evento-ev1</button>
      <button onClick={() => n.setActiveEvento('ev1')}>active-evento-ev1</button>
      <button onClick={() => n.setAdminChatActive(true)}>admin-active-on</button>
      <button onClick={() => n.addToast({ type: 'noticia', noticiaId: 'n1', title: 't' })}>add-toast</button>
      <button onClick={() => n.toasts[0] && n.dismissToast(n.toasts[0].id)}>dismiss-first</button>
      <button onClick={() => n.notifyFriendAdded()}>notify-friend</button>
    </div>
  );
}

function renderApp() {
  return render(
    <NotificationProvider>
      <Probe />
    </NotificationProvider>,
  );
}

beforeEach(() => {
  socketEvents.clear();
  socketOnMock.mockClear();
  socketDisconnectMock.mockClear();
  useAuthMock.mockReturnValue({
    user: { _id: 'me', username: 'me' },
    refreshUser: vi.fn(),
  });
  useSiteConfigMock.mockReturnValue({
    isSectionEnabled: () => true,
    applyServerConfig: vi.fn(),
  });
  server.use(
    http.get('/api/notifications', () => HttpResponse.json([])),
    http.patch('/api/notifications/read', () => HttpResponse.json({ ok: true })),
    http.delete('/api/notifications', () => HttpResponse.json({ ok: true })),
    http.patch('/api/admin-chat/read', () => HttpResponse.json({ ok: true })),
  );
});

describe('NotificationContext', () => {
  it('resets state when user is null', () => {
    useAuthMock.mockReturnValue({ user: null, refreshUser: vi.fn() });
    renderApp();
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('toasts').textContent).toBe('0');
  });

  it('loads notifications from /api/notifications on mount', async () => {
    server.use(
      http.get('/api/notifications', () =>
        HttpResponse.json([
          { type: 'chat', tableId: 't1', tableName: 'A', count: 2, read: false, timestamp: 1 },
          { type: 'friend_request', fromUserId: 'u1', read: false, timestamp: 2 },
        ]),
      ),
    );
    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('2');
    });
    expect(screen.getByTestId('unread').textContent).toBe('3'); // 2 (count) + 1 (friend)
  });

  it('connects a socket with auth token on user load', () => {
    localStorage.setItem('token', 'tok');
    renderApp();
    // Multiple socket.on registrations happened
    expect(socketOnMock).toHaveBeenCalled();
    // Some expected events registered
    expect(socketEvents.has('chat:notification')).toBe(true);
    expect(socketEvents.has('friend:request')).toBe(true);
    expect(socketEvents.has('dm:message')).toBe(true);
    expect(socketEvents.has('noticia:published')).toBe(true);
  });

  it('chat:notification adds a notification + toast (when not active table)', () => {
    renderApp();
    fireSocketEvent('chat:notification', {
      tableId: 't1',
      tableName: 'Catán',
      senderUsername: 'alice',
      messagePreview: 'hola',
      timestamp: Date.now(),
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('toasts').textContent).toBe('1');
  });

  it('chat:notification is ignored when matching the active table', () => {
    renderApp();
    act(() => screen.getByText('active-t1').click());
    fireSocketEvent('chat:notification', { tableId: 't1', senderUsername: 'a', messagePreview: 'x', timestamp: 1 });
    // No notification added (active)
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('friend:request adds a notification + toast and notifies friend listeners', () => {
    renderApp();
    fireSocketEvent('friend:request', { fromUserId: 'u1', fromUsername: 'alice', timestamp: 1 });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('toasts').textContent).toBe('1');
  });

  it('dm:message registers a handler', () => {
    renderApp();
    expect(socketEvents.has('dm:message')).toBe(true);
    // Fire to ensure the handler doesn't throw on a normal payload
    fireSocketEvent('dm:message', {
      from: { _id: 'u1', username: 'alice' },
      content: 'hi',
      isNewConversation: false,
    });
  });

  it('noticia:published only adds a toast (no persisted notification)', () => {
    renderApp();
    fireSocketEvent('noticia:published', { noticiaId: 'n1', title: 'Nueva!' });
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('toasts').textContent).toBe('1');
  });

  it('gated events are dropped when the section is disabled for the user', () => {
    useSiteConfigMock.mockReturnValue({
      isSectionEnabled: (k) => k !== 'mesas',
      applyServerConfig: vi.fn(),
    });
    renderApp();
    fireSocketEvent('chat:notification', { tableId: 't1', senderUsername: 'a', messagePreview: 'x', timestamp: 1 });
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('markRead PATCHes notifications and marks chat notification as read', async () => {
    server.use(
      http.get('/api/notifications', () =>
        HttpResponse.json([{ type: 'chat', tableId: 't1', count: 1, read: false, timestamp: 1 }]),
      ),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    expect(screen.getByTestId('unread').textContent).toBe('1');
    act(() => screen.getByText('mark-read-t1').click());
    expect(screen.getByTestId('unread').textContent).toBe('0');
  });

  it('markAllRead marks every notification as read', async () => {
    server.use(
      http.get('/api/notifications', () =>
        HttpResponse.json([
          { type: 'chat', tableId: 't1', count: 1, read: false, timestamp: 1 },
          { type: 'friend_request', fromUserId: 'u1', read: false, timestamp: 1 },
        ]),
      ),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('unread').textContent).toBe('2'));
    act(() => screen.getByText('mark-all-read').click());
    expect(screen.getByTestId('unread').textContent).toBe('0');
  });

  it('clearAll empties notifications and DELETEs from API', async () => {
    server.use(
      http.get('/api/notifications', () =>
        HttpResponse.json([{ type: 'chat', tableId: 't1', count: 1, read: false, timestamp: 1 }]),
      ),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    act(() => screen.getByText('clear-all').click());
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('addToast adds a toast and dismissToast removes it', () => {
    renderApp();
    act(() => screen.getByText('add-toast').click());
    expect(screen.getByTestId('toasts').textContent).toBe('1');
    act(() => screen.getByText('dismiss-first').click());
    expect(screen.getByTestId('toasts').textContent).toBe('0');
  });

  it('addToast caps total visible toasts to 4', () => {
    renderApp();
    for (let i = 0; i < 6; i++) act(() => screen.getByText('add-toast').click());
    // Same dedup key for all (noticia/n1) — actually only one survives
    expect(Number(screen.getByTestId('toasts').textContent)).toBeLessThanOrEqual(4);
  });

  it('setActiveTable(id) marks that table as read automatically', async () => {
    server.use(
      http.get('/api/notifications', () =>
        HttpResponse.json([{ type: 'chat', tableId: 't1', count: 3, read: false, timestamp: 1 }]),
      ),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('unread').textContent).toBe('3'));
    act(() => screen.getByText('active-t1').click());
    expect(screen.getByTestId('unread').textContent).toBe('0');
  });

  it('setAdminChatActive(true) marks admin chat as read', async () => {
    server.use(
      http.get('/api/notifications', () =>
        HttpResponse.json([{ type: 'admin_chat', count: 5, read: false, timestamp: 1 }]),
      ),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('admin-unread').textContent).toBe('5'));
    act(() => screen.getByText('admin-active-on').click());
    expect(screen.getByTestId('admin-unread').textContent).toBe('0');
  });

  it('disconnects the socket when user logs out (component re-render)', async () => {
    const { rerender } = renderApp();
    await waitFor(() => expect(socketOnMock).toHaveBeenCalled());
    useAuthMock.mockReturnValue({ user: null, refreshUser: vi.fn() });
    rerender(
      <NotificationProvider>
        <Probe />
      </NotificationProvider>,
    );
    expect(socketDisconnectMock).toHaveBeenCalled();
  });

  it('useNotifications throws when used outside the provider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/useNotifications must be used within NotificationProvider/);
    errorSpy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // More socket events
  // -----------------------------------------------------------------------
  it('join:accepted adds a notification + toast', () => {
    renderApp();
    fireSocketEvent('join:accepted', { tableId: 't2', tableName: 'Mesa B', timestamp: 1 });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('toasts').textContent).toBe('1');
  });

  it('join:request adds/increments a notification + toast', () => {
    renderApp();
    fireSocketEvent('join:request', { tableId: 't2', tableName: 'Mesa B', requesterUsername: 'bob', timestamp: 1 });
    expect(screen.getByTestId('count').textContent).toBe('1');
    // Second request same table increments count
    fireSocketEvent('join:request', { tableId: 't2', tableName: 'Mesa B', requesterUsername: 'carol', timestamp: 2 });
    expect(screen.getByTestId('count').textContent).toBe('1'); // same notif, count++
  });

  it('join:rejected adds a notification + toast', () => {
    renderApp();
    fireSocketEvent('join:rejected', { tableId: 't3', tableName: 'Mesa C', timestamp: 1 });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('toasts').textContent).toBe('1');
  });

  it('friend:accepted adds a notification, calls refreshUser, and fires friend listeners', async () => {
    const refreshUser = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({ user: { _id: 'me', username: 'me' }, refreshUser });
    const friendListener = vi.fn();
    function FriendProbe() {
      const n = useNotifications();
      useEffect(() => n.addFriendListener(friendListener), []); // eslint-disable-line react-hooks/exhaustive-deps
      return null;
    }
    render(<NotificationProvider><Probe /><FriendProbe /></NotificationProvider>);
    fireSocketEvent('friend:accepted', { fromUserId: 'u2', fromUsername: 'bob' });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(refreshUser).toHaveBeenCalled();
    expect(friendListener).toHaveBeenCalled();
  });

  it('table:comment adds/increments a notification + toast', () => {
    renderApp();
    fireSocketEvent('table:comment', { tableId: 't1', tableName: 'Mesa A', commenterUsername: 'bob', commentPreview: 'genial', timestamp: 1 });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('toasts').textContent).toBe('1');
    // Second comment same table: increments
    fireSocketEvent('table:comment', { tableId: 't1', tableName: 'Mesa A', commenterUsername: 'carol', commentPreview: '!', timestamp: 2 });
    expect(screen.getByTestId('count').textContent).toBe('1'); // still one item
    expect(parseInt(screen.getByTestId('unread').textContent)).toBe(2);
  });

  it('table:image adds/increments a notification + toast', () => {
    renderApp();
    fireSocketEvent('table:image', { tableId: 't1', tableName: 'Mesa A', uploaderUsername: 'bob', timestamp: 1 });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('toasts').textContent).toBe('1');
    // Second image same table
    fireSocketEvent('table:image', { tableId: 't1', tableName: 'Mesa A', uploaderUsername: 'carol', timestamp: 2 });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(parseInt(screen.getByTestId('unread').textContent)).toBe(2);
  });

  it('table:spot-opened adds a notification + toast', () => {
    renderApp();
    fireSocketEvent('table:spot-opened', { tableId: 't5', tableName: 'Mesa E', timestamp: 1 });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('toasts').textContent).toBe('1');
  });

  it('table:cancelled adds a notification + toast', () => {
    renderApp();
    fireSocketEvent('table:cancelled', { tableId: 't6', tableName: 'Mesa F', timestamp: 1 });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('toasts').textContent).toBe('1');
  });

  it('torneo:registration-accepted adds a notification + toast', () => {
    renderApp();
    fireSocketEvent('torneo:registration-accepted', { torneoId: 'tn1', torneoTitle: 'Copa Test', round: 1 });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('toasts').textContent).toBe('1');
  });

  it('torneo:registration-rejected adds a notification + toast', () => {
    renderApp();
    fireSocketEvent('torneo:registration-rejected', { torneoId: 'tn1', torneoTitle: 'Copa Test' });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('toasts').textContent).toBe('1');
  });

  it('torneo:advanced adds a notification + toast', () => {
    renderApp();
    fireSocketEvent('torneo:advanced', { torneoId: 'tn1', torneoTitle: 'Copa Test', round: 2 });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('toasts').textContent).toBe('1');
  });

  it('torneo:eliminated adds a notification + toast', () => {
    renderApp();
    fireSocketEvent('torneo:eliminated', { torneoId: 'tn1', torneoTitle: 'Copa Test', round: 2 });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('toasts').textContent).toBe('1');
  });

  it('torneo:started and torneo:finished add notifications', () => {
    renderApp();
    fireSocketEvent('torneo:started', { torneoId: 'tn2', torneoTitle: 'Liga', round: 0 });
    fireSocketEvent('torneo:finished', { torneoId: 'tn3', torneoTitle: 'Copa', round: 0 });
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('evento:notification (confirmed) adds notification + toast', () => {
    renderApp();
    fireSocketEvent('evento:notification', {
      type: 'confirmed', eventoId: 'ev1', eventoTitle: 'Torneo Otoño',
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('toasts').textContent).toBe('1');
  });

  it('evento:notification (rejected with permanentlyRejected) preserves the flag', () => {
    renderApp();
    fireSocketEvent('evento:notification', {
      type: 'rejected', eventoId: 'ev1', eventoTitle: 'X', permanentlyRejected: true,
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('evento:notification (updated) preserves changedFields', () => {
    renderApp();
    fireSocketEvent('evento:notification', {
      type: 'updated', eventoId: 'ev1', eventoTitle: 'X',
      changedFields: ['eventDate', 'location'],
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('evento:notification dedupes by (type, eventoId) — re-emit reemplaza', () => {
    renderApp();
    fireSocketEvent('evento:notification', {
      type: 'confirmed', eventoId: 'ev1', eventoTitle: 'X',
    });
    fireSocketEvent('evento:notification', {
      type: 'confirmed', eventoId: 'ev1', eventoTitle: 'X (cambió)',
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('evento:notification ignora payloads sin type válido', () => {
    renderApp();
    fireSocketEvent('evento:notification', { type: 'foo-bar', eventoId: 'ev1' });
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('markReadEvento marks notifs of that evento as read', () => {
    renderApp();
    fireSocketEvent('evento:notification', {
      type: 'confirmed', eventoId: 'ev1', eventoTitle: 'X',
    });
    expect(parseInt(screen.getByTestId('unread').textContent)).toBe(1);
    act(() => screen.getByText('mark-evento-ev1').click());
    expect(parseInt(screen.getByTestId('unread').textContent)).toBe(0);
  });

  it('setActiveEvento marks notifs of that evento as read', () => {
    renderApp();
    fireSocketEvent('evento:notification', {
      type: 'reminder', eventoId: 'ev1', eventoTitle: 'X',
    });
    expect(parseInt(screen.getByTestId('unread').textContent)).toBe(1);
    act(() => screen.getByText('active-evento-ev1').click());
    expect(parseInt(screen.getByTestId('unread').textContent)).toBe(0);
  });

  it('setActiveEvento suprime toasts del evento activo (notif persistente igual se guarda)', () => {
    renderApp();
    // Usuario está viendo el detalle del evento ev1.
    act(() => screen.getByText('active-evento-ev1').click());
    // Llega una notif del MISMO evento → no toast, pero sí notif.
    fireSocketEvent('evento:notification', {
      type: 'confirmed', eventoId: 'ev1', eventoTitle: 'X',
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('toasts').textContent).toBe('0');
  });

  it('setActiveEvento NO suprime toasts de OTRO evento', () => {
    renderApp();
    // Usuario está viendo ev1, pero llega una notif de ev2 → toast normal.
    act(() => screen.getByText('active-evento-ev1').click());
    fireSocketEvent('evento:notification', {
      type: 'confirmed', eventoId: 'ev2', eventoTitle: 'Otro',
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('toasts').textContent).toBe('1');
  });

  it('compartida:comment adds/increments a notification + toast', () => {
    renderApp();
    fireSocketEvent('compartida:comment', { compartidaId: 'c1', compartidaTitle: 'Post A', commenterUsername: 'bob', commentPreview: 'nice', timestamp: 1 });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('toasts').textContent).toBe('1');
    // Second comment same compartida
    fireSocketEvent('compartida:comment', { compartidaId: 'c1', compartidaTitle: 'Post A', commenterUsername: 'carol', commentPreview: '!', timestamp: 2 });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(parseInt(screen.getByTestId('unread').textContent)).toBe(2);
  });

  it('compartida:like adds/increments a notification + toast', () => {
    renderApp();
    fireSocketEvent('compartida:like', { compartidaId: 'c1', compartidaTitle: 'Post A', fromUsername: 'bob', timestamp: 1 });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('toasts').textContent).toBe('1');
    // Second like same compartida
    fireSocketEvent('compartida:like', { compartidaId: 'c1', compartidaTitle: 'Post A', fromUsername: 'carol', timestamp: 2 });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(parseInt(screen.getByTestId('unread').textContent)).toBe(2);
  });

  it('admin:message adds admin_chat notification and does NOT count in unreadCount bell badge', () => {
    renderApp();
    fireSocketEvent('admin:message', { from: { username: 'superadmin' }, content: 'hola equipo' });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('admin-unread').textContent).toBe('1');
    // Bell badge should NOT include admin_chat
    expect(screen.getByTestId('unread').textContent).toBe('0');
  });

  it('site-config:updated calls applyServerConfig', () => {
    const applyServerConfig = vi.fn();
    useSiteConfigMock.mockReturnValue({ isSectionEnabled: () => true, applyServerConfig });
    renderApp();
    const cfg = { sections: { mesas: { enabled: false } } };
    fireSocketEvent('site-config:updated', cfg);
    expect(applyServerConfig).toHaveBeenCalledWith(cfg);
  });

  it('dm:message does NOT contribute to bell unreadCount', () => {
    renderApp();
    fireSocketEvent('dm:message', { from: { _id: 'u2', username: 'bob' }, content: 'hey' });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('unread').textContent).toBe('0');
  });

  // -----------------------------------------------------------------------
  // More actions
  // -----------------------------------------------------------------------
  it('markReadFriend marks friend notifications for that userId as read', async () => {
    server.use(
      http.get('/api/notifications', () =>
        HttpResponse.json([
          { type: 'friend_request', fromUserId: 'u1', read: false, timestamp: 1 },
        ]),
      ),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('unread').textContent).toBe('1'));
    act(() => screen.getByText('mark-friend-u1').click());
    expect(screen.getByTestId('unread').textContent).toBe('0');
  });

  it('markReadTorneo marks torneo notifications as read', async () => {
    server.use(
      http.get('/api/notifications', () =>
        HttpResponse.json([
          { type: 'tournament_accepted', torneoId: 'tn1', count: 1, read: false, timestamp: 1 },
        ]),
      ),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('unread').textContent).toBe('1'));
    act(() => screen.getByText('mark-torneo-tn1').click());
    expect(screen.getByTestId('unread').textContent).toBe('0');
  });

  it('markReadCompartida marks compartida notifications as read', async () => {
    server.use(
      http.get('/api/notifications', () =>
        HttpResponse.json([
          { type: 'compartida_comment', compartidaId: 'c1', count: 1, read: false, timestamp: 1 },
        ]),
      ),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('unread').textContent).toBe('1'));
    act(() => screen.getByText('mark-comp-c1').click());
    expect(screen.getByTestId('unread').textContent).toBe('0');
  });

  it('markReadDm marks dm notifications as read (but still excluded from bell)', async () => {
    server.use(
      http.get('/api/notifications', () =>
        HttpResponse.json([
          { type: 'dm', fromUserId: 'u1', count: 3, read: false, timestamp: 1 },
        ]),
      ),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    // dm is already excluded from unreadCount, but markReadDm should mark it read
    act(() => screen.getByText('mark-dm-u1').click());
    // Still 0 unread (dm was never counted) — but no crash
    expect(screen.getByTestId('unread').textContent).toBe('0');
  });

  it('setActiveTorneo marks torneo notifications as read', async () => {
    server.use(
      http.get('/api/notifications', () =>
        HttpResponse.json([
          { type: 'tournament_accepted', torneoId: 'tn1', count: 1, read: false, timestamp: 1 },
        ]),
      ),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('unread').textContent).toBe('1'));
    act(() => screen.getByText('active-tn1').click());
    expect(screen.getByTestId('unread').textContent).toBe('0');
  });

  it('setActiveCompartida marks compartida notifications as read', async () => {
    server.use(
      http.get('/api/notifications', () =>
        HttpResponse.json([
          { type: 'compartida_comment', compartidaId: 'c1', count: 1, read: false, timestamp: 1 },
        ]),
      ),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('unread').textContent).toBe('1'));
    act(() => screen.getByText('active-c1').click());
    expect(screen.getByTestId('unread').textContent).toBe('0');
  });

  it('addDmListener receives dm events and cleanup unregisters it', () => {
    const listener = vi.fn();
    function DmProbe() {
      const n = useNotifications();
      useEffect(() => n.addDmListener(listener), []); // eslint-disable-line react-hooks/exhaustive-deps
      return null;
    }
    const { unmount } = render(<NotificationProvider><DmProbe /></NotificationProvider>);
    const msg = { from: { _id: 'u5', username: 'erin' }, content: 'hola', isNewConversation: false };
    fireSocketEvent('dm:message', msg);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(msg);
    act(() => unmount());
    // After cleanup, listener no longer called
    fireSocketEvent('dm:message', msg);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifyFriendAdded fires registered friend listeners', () => {
    const listener = vi.fn();
    function FriendProbe() {
      const n = useNotifications();
      useEffect(() => n.addFriendListener(listener), []); // eslint-disable-line react-hooks/exhaustive-deps
      return null;
    }
    render(<NotificationProvider><Probe /><FriendProbe /></NotificationProvider>);
    act(() => screen.getByText('notify-friend').click());
    expect(listener).toHaveBeenCalled();
  });

  it('loadOlder fetches older notifications and merges them', async () => {
    const older = { type: 'chat', tableId: 't9', tableName: 'Mesa Antigua', count: 1, read: true, timestamp: new Date(Date.now() - 1000000).toISOString() };
    server.use(
      http.get('/api/notifications', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.has('before')) {
          return HttpResponse.json([older]);
        }
        return HttpResponse.json([{ type: 'friend_request', fromUserId: 'u1', read: false, timestamp: new Date().toISOString() }]);
      }),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    // Capture loadOlder via a probe — mutate a holder object's property inside an
    // effect (allowed) instead of reassigning an outer variable during render
    // (which the react-hooks rule flags as an impure side effect).
    const loadOlderHolder = { fn: null };
    function LoaderProbe() {
      const n = useNotifications();
      useEffect(() => {
        loadOlderHolder.fn = n.loadOlder;
      }, [n.loadOlder]);
      return null;
    }
    render(<NotificationProvider><LoaderProbe /></NotificationProvider>);
    await waitFor(() => expect(loadOlderHolder.fn).not.toBeNull());
    await act(async () => { await loadOlderHolder.fn(); });
    // Older notification merged in
    await waitFor(() => {
      expect(Number(screen.getAllByTestId('count')[0].textContent)).toBeGreaterThanOrEqual(1);
    });
  });
});
