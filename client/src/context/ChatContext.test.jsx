import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';

const useAuthMock = vi.fn();
const useNotificationsMock = vi.fn();
const addDmListenerMock = vi.fn();
const addToastMock = vi.fn();
const markReadDmMock = vi.fn();

vi.mock('./AuthContext', () => ({ useAuth: () => useAuthMock() }));
vi.mock('./NotificationContext', () => ({ useNotifications: () => useNotificationsMock() }));

import { ChatProvider, useChat } from './ChatContext';

let lastDmListener = null;

function Probe() {
  const c = useChat();
  return (
    <div>
      <span data-testid="conv-count">{Object.keys(c.conversations).length}</span>
      <span data-testid="open-order">{c.openOrder.join(',')}</span>
      <span data-testid="unread-total">{c.dmUnreadTotal}</span>
      <span data-testid="minimized-u1">{String(c.conversations.u1?.minimized || false)}</span>
      <span data-testid="messages-u1">{(c.conversations.u1?.messages || []).length}</span>
      <button onClick={() => c.openChat({ _id: 'u1', username: 'alice' })}>open-u1</button>
      <button onClick={() => c.openChat({ _id: 'u2', username: 'bob' })}>open-u2</button>
      <button onClick={() => c.openChat({ _id: 'u3', username: 'carol' })}>open-u3</button>
      <button onClick={() => c.openChat({ _id: 'u4', username: 'dan' })}>open-u4</button>
      <button onClick={() => c.closeChat('u1')}>close-u1</button>
      <button onClick={() => c.minimizeChat('u1')}>minimize-u1</button>
      <button onClick={() => c.clearConversationUnread('u1')}>clear-u1</button>
      <button onClick={() => c.sendMessage('u1', 'hello')}>send-u1</button>
    </div>
  );
}

function renderApp() {
  return render(
    <ChatProvider>
      <Probe />
    </ChatProvider>,
  );
}

beforeEach(() => {
  lastDmListener = null;
  addDmListenerMock.mockReset();
  addToastMock.mockReset();
  markReadDmMock.mockReset();
  // Capture the listener so tests can fire it manually
  addDmListenerMock.mockImplementation((fn) => {
    lastDmListener = fn;
    return () => { lastDmListener = null; };
  });
  useAuthMock.mockReturnValue({ user: { _id: 'me', username: 'me' } });
  useNotificationsMock.mockReturnValue({
    addDmListener: addDmListenerMock,
    addToast: addToastMock,
    markReadDm: markReadDmMock,
  });
  server.use(
    http.get('/api/dm', () => HttpResponse.json([])),
    http.get('/api/dm/:userId', () => HttpResponse.json([])),
    http.post('/api/dm/:userId', async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ _id: 'mNew', content: body.content, from: 'me', to: 'u1' });
    }),
    http.patch('/api/dm/:userId/read', () => HttpResponse.json({ ok: true })),
  );
});

describe('ChatContext', () => {
  it('resets state when user is null (logged out)', async () => {
    useAuthMock.mockReturnValue({ user: null });
    renderApp();
    expect(screen.getByTestId('conv-count').textContent).toBe('0');
    expect(screen.getByTestId('open-order').textContent).toBe('');
  });

  it('loads conversation list on mount', async () => {
    server.use(
      http.get('/api/dm', () =>
        HttpResponse.json([
          { contact: { _id: 'u1', username: 'alice' }, lastMessage: { content: 'hi' }, unread: 2 },
          { contact: { _id: 'u2', username: 'bob' }, lastMessage: { content: 'yo' }, unread: 0 },
        ]),
      ),
    );
    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId('conv-count').textContent).toBe('2');
    });
    expect(screen.getByTestId('unread-total').textContent).toBe('2');
  });

  it('openChat adds the userId to openOrder and resets unread', async () => {
    renderApp();
    await act(async () => screen.getByText('open-u1').click());
    expect(screen.getByTestId('open-order').textContent).toBe('u1');
  });

  it('openChat respects MAX_WINDOWS=3, slicing oldest off', async () => {
    renderApp();
    await act(async () => screen.getByText('open-u1').click());
    await act(async () => screen.getByText('open-u2').click());
    await act(async () => screen.getByText('open-u3').click());
    await act(async () => screen.getByText('open-u4').click());
    // u1 should have been sliced out — only u2, u3, u4 remain
    expect(screen.getByTestId('open-order').textContent).toBe('u2,u3,u4');
  });

  it('closeChat removes the userId from openOrder', async () => {
    renderApp();
    await act(async () => screen.getByText('open-u1').click());
    await act(async () => screen.getByText('close-u1').click());
    expect(screen.getByTestId('open-order').textContent).toBe('');
  });

  it('minimizeChat toggles the minimized flag', async () => {
    renderApp();
    await act(async () => screen.getByText('open-u1').click());
    expect(screen.getByTestId('minimized-u1').textContent).toBe('false');
    await act(async () => screen.getByText('minimize-u1').click());
    expect(screen.getByTestId('minimized-u1').textContent).toBe('true');
    await act(async () => screen.getByText('minimize-u1').click());
    expect(screen.getByTestId('minimized-u1').textContent).toBe('false');
  });

  it('clearConversationUnread zeroes the unread for that conversation', async () => {
    server.use(
      http.get('/api/dm', () =>
        HttpResponse.json([{ contact: { _id: 'u1', username: 'alice' }, unread: 5 }]),
      ),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('unread-total').textContent).toBe('5'));
    await act(async () => screen.getByText('clear-u1').click());
    expect(screen.getByTestId('unread-total').textContent).toBe('0');
  });

  it('sendMessage POSTs and appends the new message to the conversation', async () => {
    renderApp();
    await act(async () => screen.getByText('open-u1').click());
    expect(screen.getByTestId('messages-u1').textContent).toBe('0');
    await act(async () => { await screen.getByText('send-u1').click(); });
    await waitFor(() => {
      expect(screen.getByTestId('messages-u1').textContent).toBe('1');
    });
  });

  it('incoming DM via listener increments unread and emits a toast (when not open)', async () => {
    renderApp();
    // Wait for listener to register
    await waitFor(() => expect(lastDmListener).not.toBeNull());
    expect(lastDmListener).toBeTypeOf('function');
    act(() => {
      lastDmListener({
        from: { _id: 'u1', username: 'alice' },
        content: 'hola',
        isNewConversation: false,
      });
    });
    expect(screen.getByTestId('unread-total').textContent).toBe('1');
    expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'dm', fromUserId: 'u1' }));
  });

  it('incoming DM does NOT toast when the chat is open & not minimized', async () => {
    renderApp();
    await act(async () => screen.getByText('open-u1').click());
    await waitFor(() => expect(lastDmListener).not.toBeNull());
    act(() => {
      lastDmListener({
        from: { _id: 'u1', username: 'alice' },
        content: 'sup',
        isNewConversation: false,
      });
    });
    expect(addToastMock).not.toHaveBeenCalled();
  });

  it('useChat throws when used outside ChatProvider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/useChat must be used within ChatProvider/);
    errorSpy.mockRestore();
  });
});
