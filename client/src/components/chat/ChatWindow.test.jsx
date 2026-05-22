import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../context/ChatContext', () => ({ useChat: vi.fn() }));
vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({ addToast: vi.fn() }),
}));

import ChatWindow from './ChatWindow';
import { useChat } from '../../context/ChatContext';

function setupConversation({
  conv = {
    user: { _id: 'friend1', username: 'alice', avatar: { url: '', publicId: '' } },
    messages: [],
    loaded: true,
    unread: 0,
    minimized: false,
  },
  closeChat = vi.fn(),
  minimizeChat = vi.fn(),
  sendMessage = vi.fn(),
} = {}) {
  useChat.mockReturnValue({
    conversations: { friend1: conv },
    closeChat,
    minimizeChat,
    sendMessage,
  });
  return render(
    <MemoryRouter>
      <ChatWindow userId="friend1" index={0} currentUserId="me" />
    </MemoryRouter>,
  );
}

describe('<ChatWindow>', () => {
  it('renders nothing when the conversation is missing from context', () => {
    useChat.mockReturnValue({
      conversations: {},
      closeChat: vi.fn(),
      minimizeChat: vi.fn(),
      sendMessage: vi.fn(),
    });
    const { container } = render(
      <MemoryRouter>
        <ChatWindow userId="friend1" index={0} currentUserId="me" />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the contact username in the header', () => {
    setupConversation();
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('shows the unread badge when minimized + unread > 0', () => {
    setupConversation({
      conv: {
        user: { _id: 'friend1', username: 'alice' },
        messages: [],
        loaded: true,
        unread: 5,
        minimized: true,
      },
    });
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('caps the unread badge at "9+" when > 9', () => {
    setupConversation({
      conv: {
        user: { _id: 'friend1', username: 'alice' },
        messages: [],
        loaded: true,
        unread: 12,
        minimized: true,
      },
    });
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('header click triggers minimizeChat', () => {
    const minimizeChat = vi.fn();
    setupConversation({ minimizeChat });
    // The header is the topmost div under .window; click its container by clicking the username text.
    fireEvent.click(screen.getByText('alice').parentElement.parentElement);
    expect(minimizeChat).toHaveBeenCalledWith('friend1');
  });

  it('close button calls closeChat', () => {
    const closeChat = vi.fn();
    setupConversation({ closeChat });
    const closeBtn = screen.getByTitle('Cerrar');
    fireEvent.click(closeBtn);
    expect(closeChat).toHaveBeenCalledWith('friend1');
  });

  it('renders message bubbles', () => {
    setupConversation({
      conv: {
        user: { _id: 'friend1', username: 'alice' },
        messages: [
          { _id: 'm1', from: { _id: 'friend1' }, content: 'hola', createdAt: new Date().toISOString() },
          { _id: 'm2', from: { _id: 'me' }, content: 'qué hacés', createdAt: new Date().toISOString() },
        ],
        loaded: true,
        unread: 0,
        minimized: false,
      },
    });
    expect(screen.getByText('hola')).toBeInTheDocument();
    expect(screen.getByText('qué hacés')).toBeInTheDocument();
  });

  it('typing + submit calls sendMessage', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    setupConversation({ sendMessage });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'mensaje' } });
    fireEvent.submit(input.closest('form'));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('friend1', 'mensaje'));
  });

  it('"Ver perfil" link points to /usuarios/:id', () => {
    setupConversation();
    expect(screen.getByTitle('Ver perfil')).toHaveAttribute('href', '/usuarios/friend1');
  });
});
