import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../context/ChatContext', () => ({ useChat: vi.fn() }));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import DirectChat from './DirectChat';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

const ME = { _id: 'me', username: 'me' };

function setup({
  user = ME,
  conversations = {},
  sendMessage = vi.fn(),
  openChat = vi.fn(),
  contactId = 'friend1',
  contact = { _id: 'friend1', username: 'alice', avatar: { url: '', publicId: '' } },
} = {}) {
  useAuth.mockReturnValue({ user });
  useChat.mockReturnValue({ conversations, openChat, sendMessage });
  server.use(
    http.get('/api/users/:id', () => HttpResponse.json(contact)),
  );
  return render(
    <MemoryRouter initialEntries={[`/mensajes/${contactId}`]}>
      <Routes>
        <Route path="/mensajes/:userId" element={<DirectChat />} />
        <Route path="/mensajes" element={<div>messages-list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateMock.mockReset();
});

describe('<DirectChat>', () => {
  it('renders the contact name once loaded', async () => {
    setup();
    expect(await screen.findByText('alice')).toBeInTheDocument();
  });

  it('shows loading state until the conversation is marked loaded', () => {
    setup();
    expect(screen.getByText(/cargando mensajes/i)).toBeInTheDocument();
  });

  it('renders messages from the conversation', async () => {
    setup({
      conversations: {
        friend1: {
          user: { _id: 'friend1', username: 'alice' },
          messages: [
            { _id: 'm1', from: { _id: 'friend1', username: 'alice' }, content: 'hola', createdAt: new Date().toISOString() },
            { _id: 'm2', from: { _id: 'me', username: 'me' }, content: 'qué hacés', createdAt: new Date().toISOString() },
          ],
          loaded: true,
          unread: 0,
        },
      },
    });
    await screen.findByText('alice');
    expect(screen.getByText('hola')).toBeInTheDocument();
    expect(screen.getByText('qué hacés')).toBeInTheDocument();
  });

  it('clicking back button navigates to /mensajes', async () => {
    setup();
    await screen.findByText('alice');
    // The back button is the first button (svg only); pick it via role and position
    const btns = screen.getAllByRole('button');
    fireEvent.click(btns[0]);
    expect(navigateMock).toHaveBeenCalledWith('/mensajes');
  });

  it('typing + submitting sends a message via sendMessage', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    setup({
      conversations: {
        friend1: { user: { _id: 'friend1', username: 'alice' }, messages: [], loaded: true, unread: 0 },
      },
      sendMessage,
    });
    await screen.findByText('alice');

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'hola' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('friend1', 'hola'));
  });

  it('redirects to /mensajes when the contact fetch fails', async () => {
    server.use(http.get('/api/users/:id', () => HttpResponse.json({}, { status: 404 })));
    useAuth.mockReturnValue({ user: ME });
    useChat.mockReturnValue({ conversations: {}, openChat: vi.fn(), sendMessage: vi.fn() });
    render(
      <MemoryRouter initialEntries={['/mensajes/missing']}>
        <Routes>
          <Route path="/mensajes/:userId" element={<DirectChat />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/mensajes', { replace: true });
    });
  });
});
