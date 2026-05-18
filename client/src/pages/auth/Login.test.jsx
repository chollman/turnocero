import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import Login from './Login';
import { useAuth } from '../../context/AuthContext';

beforeEach(() => {
  navigateMock.mockReset();
  // Stub the showcase endpoint so the page doesn't trigger an unhandled-request MSW error.
  server.use(
    http.get('/api/tables/showcase', () => HttpResponse.json({ total: 0, table: null })),
  );
});

function renderLogin(login = vi.fn()) {
  useAuth.mockReturnValue({ login });
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
}

describe('<Login>', () => {
  it('renders email + password fields + submit button', () => {
    renderLogin();
    expect(screen.getByPlaceholderText('tu@email.com')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('••••••••').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('calls login(email, password) on submit and navigates to /', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    renderLogin(login);

    fireEvent.change(screen.getByPlaceholderText('tu@email.com'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('a@b.com', 'Password123');
    });
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('redirects to /verificar-email on 403 email_not_verified', async () => {
    const login = vi.fn().mockRejectedValue({
      response: {
        data: { code: 'email_not_verified', email: 'unv@b.com' },
        status: 403,
      },
    });
    renderLogin(login);

    fireEvent.change(screen.getByPlaceholderText('tu@email.com'), { target: { value: 'unv@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(
        '/verificar-email',
        expect.objectContaining({ state: expect.objectContaining({ email: 'unv@b.com' }) }),
      );
    });
  });

  it('shows the API error message on any other failure', async () => {
    const login = vi.fn().mockRejectedValue({
      response: { data: { message: 'Invalid email or password' }, status: 401 },
    });
    renderLogin(login);

    fireEvent.change(screen.getByPlaceholderText('tu@email.com'), { target: { value: 'x@y.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });

  it('shows a banned message from sessionStorage on mount and clears it', () => {
    sessionStorage.setItem('bannedMessage', 'Tu cuenta fue suspendida');
    renderLogin();
    expect(screen.getByText('Tu cuenta fue suspendida')).toBeInTheDocument();
    expect(sessionStorage.getItem('bannedMessage')).toBeNull();
  });

  it('shows a flash message from sessionStorage on mount and clears it', () => {
    sessionStorage.setItem('flashMessage', 'Contraseña actualizada');
    renderLogin();
    expect(screen.getByText('Contraseña actualizada')).toBeInTheDocument();
    expect(sessionStorage.getItem('flashMessage')).toBeNull();
  });

  it('exposes a "¿Olvidaste tu contraseña?" link', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /olvidaste/i })).toHaveAttribute(
      'href', '/recuperar-contrasenia',
    );
  });

  it('exposes a "Crear cuenta" link', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /crear cuenta/i })).toHaveAttribute(
      'href', '/register',
    );
  });
});
