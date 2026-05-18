import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const useNotificationsMock = vi.fn();
const useChatMock = vi.fn();
vi.mock('../../context/NotificationContext', () => ({ useNotifications: () => useNotificationsMock() }));
vi.mock('../../context/ChatContext', () => ({ useChat: () => useChatMock() }));

import ToastContainer from './ToastContainer';

function defaultNotificationsValue(toasts = []) {
  return {
    toasts,
    dismissToast: vi.fn(),
    markRead: vi.fn(),
    markReadFriend: vi.fn(),
    markReadTorneo: vi.fn(),
    markReadCompartida: vi.fn(),
  };
}

beforeEach(() => {
  navigateMock.mockReset();
  useChatMock.mockReturnValue({ openChat: vi.fn(), conversations: {} });
});

function renderToasts(toasts) {
  useNotificationsMock.mockReturnValue(defaultNotificationsValue(toasts));
  return render(
    <MemoryRouter>
      <ToastContainer />
    </MemoryRouter>,
  );
}

describe('<ToastContainer>', () => {
  it('renders nothing when toasts is empty', () => {
    const { container } = renderToasts([]);
    expect(container.firstChild).toBeNull();
  });

  it('renders a toast with title + body and icon', () => {
    renderToasts([
      { id: 't1', type: 'join_accepted', tableName: 'Catán' },
    ]);
    expect(screen.getByText('¡Fuiste aceptado!')).toBeInTheDocument();
    expect(screen.getByText(/ya sos parte de la mesa de catán/i)).toBeInTheDocument();
    expect(screen.getByText('✅')).toBeInTheDocument();
  });

  it('renders friend_request toast with friend username as title', () => {
    renderToasts([
      { id: 't1', type: 'friend_request', fromUsername: 'alice', fromUserId: 'u1' },
    ]);
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText(/solicitud de amistad/i)).toBeInTheDocument();
  });

  it('navigates to /usuarios/:id when friend_request toast clicked', () => {
    renderToasts([
      { id: 't1', type: 'friend_request', fromUsername: 'alice', fromUserId: 'u1' },
    ]);
    fireEvent.click(screen.getByRole('alert'));
    expect(navigateMock).toHaveBeenCalledWith('/usuarios/u1');
  });

  it('navigates to /torneos/:id when tournament_accepted toast clicked', () => {
    renderToasts([
      { id: 't1', type: 'tournament_accepted', torneoTitle: 'Liga 26', torneoId: 'tn1' },
    ]);
    fireEvent.click(screen.getByRole('alert'));
    expect(navigateMock).toHaveBeenCalledWith('/torneos/tn1');
  });

  it('navigates to /compartidas/:id when compartida_like toast clicked', () => {
    renderToasts([
      { id: 't1', type: 'compartida_like', fromUsername: 'alice', compartidaId: 'c1' },
    ]);
    fireEvent.click(screen.getByRole('alert'));
    expect(navigateMock).toHaveBeenCalledWith('/compartidas/c1');
  });

  it('navigates to /noticias/:id when noticia toast clicked', () => {
    renderToasts([
      { id: 't1', type: 'noticia', noticiaId: 'n1', title: 'Nueva noticia!' },
    ]);
    fireEvent.click(screen.getByRole('alert'));
    expect(navigateMock).toHaveBeenCalledWith('/noticias/n1');
  });

  it('navigates to /mesas/:id by default for table-related toasts', () => {
    renderToasts([
      { id: 't1', type: 'spot_opened', tableName: 'Catán', tableId: 'm1' },
    ]);
    fireEvent.click(screen.getByRole('alert'));
    expect(navigateMock).toHaveBeenCalledWith('/mesas/m1');
  });

  it('Cerrar button dismisses the toast without navigating', () => {
    const dismissToast = vi.fn();
    useNotificationsMock.mockReturnValue({
      ...defaultNotificationsValue(),
      toasts: [{ id: 't1', type: 'join_accepted', tableName: 'Catán' }],
      dismissToast,
    });
    render(
      <MemoryRouter>
        <ToastContainer />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText('Cerrar'));
    expect(dismissToast).toHaveBeenCalledWith('t1');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('renders multiple toasts', () => {
    renderToasts([
      { id: 't1', type: 'noticia', noticiaId: 'n1', title: 'Uno' },
      { id: 't2', type: 'tournament_finished', torneoTitle: 'Liga', torneoId: 'tn1' },
    ]);
    expect(screen.getAllByRole('alert').length).toBe(2);
  });
});
