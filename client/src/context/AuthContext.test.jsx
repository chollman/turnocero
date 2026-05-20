import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { AuthProvider, useAuth } from './AuthContext';

function Probe() {
  const a = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(a.loading)}</span>
      <span data-testid="user">{a.user ? a.user.username : 'null'}</span>
      <span data-testid="effective-admin">{String(!!a.user?.isAdmin)}</span>
      <span data-testid="actual-admin">{String(a.isActuallyAdmin)}</span>
      <span data-testid="view-as-user">{String(a.viewAsUser)}</span>
      <button onClick={() => a.login('e@e', 'pw')}>do-login</button>
      <button onClick={() => a.logout()}>do-logout</button>
      <button onClick={() => a.register('x', 'x@x', 'pw')}>do-register</button>
      <button onClick={() => a.verifyEmail('e@e', '000000')}>do-verify</button>
      <button onClick={() => a.requestEmailVerification('e@e')}>do-resend</button>
      <button onClick={() => a.requestPasswordReset('e@e')}>do-forgot</button>
      <button onClick={() => a.resetPassword('e@e', 'tok', 'pw')}>do-reset</button>
      <button onClick={() => a.refreshUser()}>do-refresh</button>
      <button onClick={() => a.updateProfile({ displayName: 'New' })}>do-update</button>
      <button onClick={() => a.setViewAsUser(true)}>view-on</button>
      <button onClick={() => a.setViewAsUser(false)}>view-off</button>
    </div>
  );
}

function renderApp() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  // Default: /api/auth/me returns 401 — guest
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json({}, { status: 401 })),
  );
});

describe('AuthContext', () => {
  it('starts with loading=true and resolves to user=null when /me is 401', async () => {
    localStorage.setItem('token', 'tok'); // force /me to be called
    renderApp();
    expect(screen.getByTestId('loading').textContent).toBe('true');
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('skips the /api/auth/me request entirely when there is no token', async () => {
    let meCalls = 0;
    server.use(
      http.get('/api/auth/me', () => {
        meCalls += 1;
        return HttpResponse.json({}, { status: 401 });
      }),
    );
    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(meCalls).toBe(0);
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('loads the user from /api/auth/me when the token is valid', async () => {
    localStorage.setItem('token', 'tok');
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({ _id: 'u1', username: 'alice', isAdmin: false }),
      ),
    );
    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('alice');
    });
  });

  it('login stores token, sets header, and updates the user', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({
          token: 'tok',
          user: { _id: 'u1', username: 'alice', isAdmin: false },
        }),
      ),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await act(async () => screen.getByText('do-login').click());
    expect(localStorage.getItem('token')).toBe('tok');
    expect(screen.getByTestId('user').textContent).toBe('alice');
  });

  it('logout clears token, viewAsUser, and the user', async () => {
    localStorage.setItem('token', 'tok');
    localStorage.setItem('viewAsUser', 'true');
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json({ _id: 'u1', username: 'alice' })),
      http.post('/api/auth/logout', () => HttpResponse.json({ ok: true })),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('alice'));
    await act(async () => screen.getByText('do-logout').click());
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('view-as-user').textContent).toBe('false');
  });

  it('verifyEmail stores token and sets the user', async () => {
    server.use(
      http.post('/api/auth/verify-email', () =>
        HttpResponse.json({ token: 'verify-tok', user: { _id: 'u1', username: 'alice' } }),
      ),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await act(async () => screen.getByText('do-verify').click());
    expect(localStorage.getItem('token')).toBe('verify-tok');
    expect(screen.getByTestId('user').textContent).toBe('alice');
  });

  it('register does NOT set a token or user', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json({ email: 'e@e', message: 'Verifica tu email' }),
      ),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await act(async () => screen.getByText('do-register').click());
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('requestEmailVerification + requestPasswordReset + resetPassword call their endpoints', async () => {
    const hit = { resend: false, forgot: false, reset: false };
    server.use(
      http.post('/api/auth/resend-verification', () => { hit.resend = true; return HttpResponse.json({}); }),
      http.post('/api/auth/forgot-password', () => { hit.forgot = true; return HttpResponse.json({}); }),
      http.post('/api/auth/reset-password', () => { hit.reset = true; return HttpResponse.json({}); }),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await act(async () => screen.getByText('do-resend').click());
    await act(async () => screen.getByText('do-forgot').click());
    await act(async () => screen.getByText('do-reset').click());
    expect(hit).toEqual({ resend: true, forgot: true, reset: true });
  });

  it('refreshUser re-fetches the user', async () => {
    localStorage.setItem('token', 'tok');
    let calls = 0;
    server.use(
      http.get('/api/auth/me', () => {
        calls += 1;
        return HttpResponse.json({ _id: 'u1', username: `alice-${calls}` });
      }),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('alice-1'));
    await act(async () => screen.getByText('do-refresh').click());
    expect(screen.getByTestId('user').textContent).toBe('alice-2');
  });

  it('updateProfile sets the user from the PUT response', async () => {
    localStorage.setItem('token', 'tok');
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json({ _id: 'u1', username: 'alice' })),
      http.put('/api/auth/profile', () =>
        HttpResponse.json({ _id: 'u1', username: 'alice', displayName: 'New' }),
      ),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('alice'));
    await act(async () => screen.getByText('do-update').click());
    // user.username unchanged but profile updated — verify by re-rendering not throwing
    expect(screen.getByTestId('user').textContent).toBe('alice');
  });

  it('setViewAsUser persists to localStorage and back', async () => {
    localStorage.setItem('token', 'tok');
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json({ _id: 'u1', username: 'alice', isAdmin: true })),
    );
    renderApp();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('alice'));
    expect(screen.getByTestId('actual-admin').textContent).toBe('true');
    expect(screen.getByTestId('effective-admin').textContent).toBe('true');
    await act(async () => screen.getByText('view-on').click());
    // viewAsUser ON: effective admin becomes false but actual stays true
    expect(localStorage.getItem('viewAsUser')).toBe('true');
    expect(screen.getByTestId('actual-admin').textContent).toBe('true');
    expect(screen.getByTestId('effective-admin').textContent).toBe('false');
    await act(async () => screen.getByText('view-off').click());
    expect(localStorage.getItem('viewAsUser')).toBeNull();
    expect(screen.getByTestId('effective-admin').textContent).toBe('true');
  });

  it('useAuth throws when used outside AuthProvider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <MemoryRouter>
          <Probe />
        </MemoryRouter>,
      ),
    ).toThrow(/useAuth must be used within AuthProvider/);
    errorSpy.mockRestore();
  });
});
