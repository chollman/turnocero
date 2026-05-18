import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../context/NotificationContext', () => ({ useNotifications: vi.fn() }));

// Mock socket.io-client so AdminChat doesn't open real connections.
vi.mock('socket.io-client', () => ({
  io: () => ({ on: () => {}, off: () => {}, emit: () => {}, disconnect: () => {} }),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import AdminChat from './AdminChat';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

function setup({
  user = { _id: 'admin', username: 'admin' },
  isActuallyAdmin = true,
  messages = [],
} = {}) {
  useAuth.mockReturnValue({ user, isActuallyAdmin });
  useNotifications.mockReturnValue({ setAdminChatActive: vi.fn() });
  server.use(
    http.get('/api/admin-chat', () => HttpResponse.json(messages)),
    http.post('/api/admin-chat', () => HttpResponse.json({ _id: 'new', content: 'x' })),
  );
  return render(
    <MemoryRouter>
      <AdminChat />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateMock.mockReset();
});

describe('<AdminChat>', () => {
  it('non-admin gets redirected to /', () => {
    setup({ user: { _id: 'me' }, isActuallyAdmin: false });
    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true });
  });

  it('admin sees the chat interface', async () => {
    setup({ isActuallyAdmin: true });
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders messages from the API', async () => {
    setup({
      isActuallyAdmin: true,
      messages: [
        { _id: 'm1', from: { _id: 'admin1', username: 'admin1' }, content: 'Hola admins', createdAt: new Date().toISOString() },
        { _id: 'm2', from: { _id: 'admin2', username: 'admin2' }, content: 'Buenas', createdAt: new Date().toISOString() },
      ],
    });
    await waitFor(() => {
      expect(screen.getByText('Hola admins')).toBeInTheDocument();
      expect(screen.getByText('Buenas')).toBeInTheDocument();
    });
  });

  it('submitting the form posts to /api/admin-chat', async () => {
    let posted;
    server.use(
      http.get('/api/admin-chat', () => HttpResponse.json([])),
      http.post('/api/admin-chat', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ _id: 'm-new', content: posted.content });
      }),
    );
    useAuth.mockReturnValue({ user: { _id: 'admin' }, isActuallyAdmin: true });
    useNotifications.mockReturnValue({ setAdminChatActive: vi.fn() });
    render(<MemoryRouter><AdminChat /></MemoryRouter>);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'hola mundo' } });
    fireEvent.submit(input.closest('form'));
    await waitFor(() => expect(posted).toEqual({ content: 'hola mundo' }));
  });
});
