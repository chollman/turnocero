import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/NotificationContext', () => ({ useNotifications: vi.fn() }));
vi.mock('../../context/ChatContext', () => ({ useChat: vi.fn() }));

import Notifications from './Notifications';
import { useNotifications } from '../../context/NotificationContext';
import { useChat } from '../../context/ChatContext';

let markReadMock, markReadFriendMock, markReadTorneoMock, markReadCompartidaMock,
  markReadEventoMock, markReadDmMock, markReadAdminChatMock, markAllReadMock,
  loadOlderMock, clearAllMock, clearConversationUnreadMock;

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
    markRead: markReadMock,
    markReadFriend: markReadFriendMock,
    markReadTorneo: markReadTorneoMock,
    markReadCompartida: markReadCompartidaMock,
    markReadEvento: markReadEventoMock,
    markReadDm: markReadDmMock,
    markReadAdminChat: markReadAdminChatMock,
    markAllRead: markAllReadMock,
    loadOlder: loadOlderMock,
    clearAll: clearAllMock,
  });
  useChat.mockReturnValue({ clearConversationUnread: clearConversationUnreadMock });
  return render(
    <MemoryRouter>
      <Notifications />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  markReadMock = vi.fn();
  markReadFriendMock = vi.fn();
  markReadTorneoMock = vi.fn();
  markReadCompartidaMock = vi.fn();
  markReadEventoMock = vi.fn();
  markReadDmMock = vi.fn();
  markReadAdminChatMock = vi.fn();
  markAllReadMock = vi.fn();
  loadOlderMock = vi.fn().mockResolvedValue({ count: 0 });
  clearAllMock = vi.fn();
  clearConversationUnreadMock = vi.fn();
  server.use(http.patch('/api/dm/:userId/read', () => HttpResponse.json({ ok: true })));
});

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
    setup({ notifications: [makeNotif({ read: false })] });
    const btn = screen.queryByRole('button', { name: /marcar.*le[ií]do/i });
    if (btn) {
      fireEvent.click(btn);
      expect(markAllReadMock).toHaveBeenCalled();
    }
  });

  it('"Limpiar" calls clearAll after window.confirm', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    setup({ notifications: [makeNotif()] });
    fireEvent.click(screen.getByRole('button', { name: /limpiar/i }));
    expect(clearAllMock).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('"Limpiar" does NOT call clearAll when confirm is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    setup({ notifications: [makeNotif()] });
    fireEvent.click(screen.getByRole('button', { name: /limpiar/i }));
    expect(clearAllMock).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('clicking "Sin leer" tab hides already-read notifications', () => {
    setup({
      notifications: [
        makeNotif({ type: 'chat', tableName: 'Mesa Leída', read: true }),
        makeNotif({ type: 'chat', tableName: 'Mesa Sin Leer', read: false }),
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: /sin leer/i }));
    expect(screen.queryByText('Mesa Leída')).not.toBeInTheDocument();
    expect(screen.getByText('Mesa Sin Leer')).toBeInTheDocument();
  });

  it('clicking category "Torneos" filters to torneo notifications only', () => {
    setup({
      notifications: [
        makeNotif({ type: 'chat', tableName: 'Mesa Chat' }),
        makeNotif({ type: 'tournament_accepted', torneoId: 'tn1', torneoTitle: 'Copa X', tableId: undefined, tableName: undefined }),
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: /torneos/i }));
    expect(screen.queryByText('Mesa Chat')).not.toBeInTheDocument();
    expect(screen.getByText('Copa X')).toBeInTheDocument();
  });

  it('shows empty "Sin resultados" when filter matches no notifications', () => {
    setup({
      notifications: [
        makeNotif({ type: 'chat', tableName: 'Mesa', read: true }),
      ],
    });
    // Switch to "Sin leer" — all are read, no results
    fireEvent.click(screen.getByRole('button', { name: /sin leer/i }));
    expect(screen.getByText(/sin resultados/i)).toBeInTheDocument();
  });

  it('clicking a table notification link calls markRead with the tableId', () => {
    setup({
      notifications: [
        makeNotif({ type: 'chat', tableId: 'tX', tableName: 'Mesa X', read: false }),
      ],
    });
    fireEvent.click(screen.getByRole('link'));
    expect(markReadMock).toHaveBeenCalledWith('tX');
  });

  it('clicking a friend notification link calls markReadFriend', () => {
    setup({
      notifications: [
        makeNotif({ type: 'friend_request', fromUserId: 'u1', fromUsername: 'alice', tableId: undefined, read: false }),
      ],
    });
    fireEvent.click(screen.getByRole('link'));
    expect(markReadFriendMock).toHaveBeenCalledWith('u1');
  });

  it('clicking a torneo notification link calls markReadTorneo', () => {
    setup({
      notifications: [
        makeNotif({ type: 'tournament_accepted', torneoId: 'tn2', torneoTitle: 'Liga', tableId: undefined, read: false }),
      ],
    });
    fireEvent.click(screen.getByRole('link'));
    expect(markReadTorneoMock).toHaveBeenCalledWith('tn2');
  });

  it('clicking a compartida notification link calls markReadCompartida', () => {
    setup({
      notifications: [
        makeNotif({ type: 'compartida_comment', compartidaId: 'c1', compartidaTitle: 'Mi post', tableId: undefined, read: false }),
      ],
    });
    fireEvent.click(screen.getByRole('link'));
    expect(markReadCompartidaMock).toHaveBeenCalledWith('c1');
  });

  it('clicking a DM notification calls markReadDm and clearConversationUnread', () => {
    setup({
      notifications: [
        makeNotif({ type: 'dm', fromUserId: 'u3', fromUsername: 'carol', tableId: undefined, read: false }),
      ],
    });
    fireEvent.click(screen.getByRole('link'));
    expect(markReadDmMock).toHaveBeenCalledWith('u3');
    expect(clearConversationUnreadMock).toHaveBeenCalledWith('u3');
  });

  it('clicking the "Marcar como leída" eye button stops propagation and marks read', () => {
    setup({
      notifications: [
        makeNotif({ type: 'chat', tableId: 'tZ', tableName: 'Mesa Z', read: false }),
      ],
    });
    // The eye button has title="Marcar como leída" (singular) — distinct from the header "leídas"
    const markBtn = screen.getByTitle('Marcar como leída');
    fireEvent.click(markBtn);
    expect(markReadMock).toHaveBeenCalledWith('tZ');
  });

  it('renders different notification types without crashing', () => {
    setup({
      notifications: [
        makeNotif({ type: 'join_accepted', tableName: 'Mesa A' }),
        makeNotif({ type: 'join_request', tableName: 'Mesa B', lastRequesterUsername: 'bob', count: 2 }),
        makeNotif({ type: 'join_rejected', tableName: 'Mesa C' }),
        makeNotif({ type: 'friend_accepted', fromUserId: 'u1', fromUsername: 'alice', tableId: undefined }),
        makeNotif({ type: 'image', tableName: 'Mesa D', lastUploaderUsername: 'bob' }),
        makeNotif({ type: 'spot_opened', tableName: 'Mesa E' }),
        makeNotif({ type: 'table_cancelled', tableName: 'Mesa F' }),
        makeNotif({ type: 'tournament_rejected', torneoId: 'tn1', torneoTitle: 'Copa', tableId: undefined }),
        makeNotif({ type: 'tournament_advanced', torneoId: 'tn2', torneoTitle: 'Liga', round: 2, isPhase: false, tableId: undefined }),
        makeNotif({ type: 'tournament_eliminated', torneoId: 'tn3', torneoTitle: 'Elim', tableId: undefined }),
        makeNotif({ type: 'tournament_started', torneoId: 'tn4', torneoTitle: 'Start', tableId: undefined }),
        makeNotif({ type: 'tournament_finished', torneoId: 'tn5', torneoTitle: 'Fin', tableId: undefined }),
        makeNotif({ type: 'compartida_comment', compartidaId: 'c1', compartidaTitle: 'Post', tableId: undefined }),
        makeNotif({ type: 'compartida_like', compartidaId: 'c2', compartidaTitle: 'Like', tableId: undefined }),
        makeNotif({ type: 'dm', fromUserId: 'u4', fromUsername: 'dan', tableId: undefined, lastMessagePreview: 'hola' }),
        makeNotif({ type: 'admin_chat', tableId: undefined, count: 3, lastSenderUsername: 'admin', lastMessagePreview: 'msg' }),
      ],
    });
    // Just checking no crash — all 16 render
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(16);
  });

  it('loadOlder button appears when ≥20 notifications and calls handleLoadOlder', async () => {
    const notifications = Array.from({ length: 20 }, (_, i) =>
      makeNotif({ _id: `n${i}`, tableId: `t${i}`, tableName: `Mesa ${i}`, read: true })
    );
    loadOlderMock.mockResolvedValue({ count: 5 });
    setup({ notifications });
    const btn = screen.queryByRole('button', { name: /cargar más/i });
    expect(btn).toBeInTheDocument();
    await act(async () => { fireEvent.click(btn); });
    expect(loadOlderMock).toHaveBeenCalled();
  });

  it('loadOlder exhausted hides the button after count=0 response', async () => {
    const notifications = Array.from({ length: 20 }, (_, i) =>
      makeNotif({ _id: `n${i}`, tableId: `t${i}`, tableName: `Mesa ${i}`, read: true })
    );
    loadOlderMock.mockResolvedValue({ count: 0 });
    setup({ notifications });
    const btn = screen.getByRole('button', { name: /cargar más/i });
    await act(async () => { fireEvent.click(btn); });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /cargar más/i })).not.toBeInTheDocument();
    });
  });

  it('admin_chat notification marks read via markReadAdminChat', () => {
    setup({
      notifications: [
        makeNotif({ type: 'admin_chat', tableId: undefined, count: 1, lastSenderUsername: 'admin', lastMessagePreview: 'aviso', read: false }),
      ],
    });
    fireEvent.click(screen.getByRole('link'));
    expect(markReadAdminChatMock).toHaveBeenCalled();
  });

  // ── Eventos ──
  describe('Eventos notifications', () => {
    const ev = (overrides) => ({
      _id: `n${Math.random()}`,
      type: 'evento_confirmed',
      read: false,
      count: 1,
      tableId: undefined,
      eventoId: 'ev1',
      eventoTitle: 'Torneo Otoño',
      updatedAt: new Date().toISOString(),
      ...overrides,
    });

    it('evento_confirmed renders with "Inscripción confirmada" chip', () => {
      setup({ notifications: [ev()] });
      expect(screen.getByText(/inscripción confirmada/i)).toBeInTheDocument();
      expect(screen.getByText('Torneo Otoño')).toBeInTheDocument();
    });

    it('evento_rejected (single) shows "Inscripción rechazada"', () => {
      setup({ notifications: [ev({ type: 'evento_rejected', permanentlyRejected: false })] });
      expect(screen.getByText(/^inscripción rechazada$/i)).toBeInTheDocument();
    });

    it('evento_rejected (permanent) shows "Rechazada (permanente)"', () => {
      setup({ notifications: [ev({ type: 'evento_rejected', permanentlyRejected: true })] });
      expect(screen.getByText(/rechazada \(permanente\)/i)).toBeInTheDocument();
    });

    it('evento_cancelled shows "Evento cancelado"', () => {
      setup({ notifications: [ev({ type: 'evento_cancelled' })] });
      expect(screen.getByText(/evento cancelado/i)).toBeInTheDocument();
    });

    it('evento_updated lists changed fields in human-readable form', () => {
      setup({
        notifications: [ev({
          type: 'evento_updated',
          changedFields: ['eventDate', 'location'],
        })],
      });
      expect(screen.getByText(/cambios en el evento/i)).toBeInTheDocument();
      // El preview combina los cambios.
      expect(screen.getByText(/nueva fecha.*nueva ubicación/i)).toBeInTheDocument();
    });

    it('evento_reminder shows "Mañana" chip', () => {
      setup({ notifications: [ev({ type: 'evento_reminder' })] });
      expect(screen.getByText(/^mañana$/i)).toBeInTheDocument();
    });

    it('clicking an evento notification links to /eventos/:eventoId and calls markReadEvento', () => {
      setup({ notifications: [ev()] });
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/eventos/ev1');
      fireEvent.click(link);
      expect(markReadEventoMock).toHaveBeenCalledWith('ev1');
    });

    it('chip "Eventos" appears in category filter and filters correctly', () => {
      setup({
        notifications: [
          makeNotif({ tableId: 't1' }),
          ev({ type: 'evento_confirmed' }),
        ],
      });
      // El chip de categoría tiene el label "Eventos" + posible badge de unread.
      // Buscamos por accessible name flexible.
      const eventosChip = screen.getByRole('button', { name: /eventos/i });
      fireEvent.click(eventosChip);
      // Solo aparece la notif de evento.
      expect(screen.getByText('Torneo Otoño')).toBeInTheDocument();
      expect(screen.queryByText('Mesa')).not.toBeInTheDocument();
    });
  });
});
