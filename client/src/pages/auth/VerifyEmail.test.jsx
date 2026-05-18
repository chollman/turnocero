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

import VerifyEmail from './VerifyEmail';
import { useAuth } from '../../context/AuthContext';

function renderVerify({ initialEntry = '/verificar-email', verifyEmail, requestEmailVerification } = {}) {
  useAuth.mockReturnValue({
    verifyEmail: verifyEmail || vi.fn(),
    requestEmailVerification: requestEmailVerification || vi.fn(),
  });
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <VerifyEmail />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateMock.mockReset();
  sessionStorage.clear();
  server.use(http.get('/api/tables/showcase', () => HttpResponse.json({ total: 0, table: null })));
});

describe('<VerifyEmail>', () => {
  it('renders the heading + code input', () => {
    renderVerify();
    expect(screen.getByText(/un último paso/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••')).toBeInTheDocument();
  });

  it('strips non-digits from the code input and limits to 6 characters', () => {
    renderVerify();
    const codeInput = screen.getByPlaceholderText('••••••');
    fireEvent.change(codeInput, { target: { value: 'abc12-34567890def' } });
    expect(codeInput.value).toBe('123456');
  });

  it('Submit is disabled until 6 digits are entered', () => {
    renderVerify({ initialEntry: { pathname: '/verificar-email', state: { email: 'a@b.com' } } });
    const submit = screen.getByRole('button', { name: /verificar/i });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('••••••'), { target: { value: '12345' } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('••••••'), { target: { value: '123456' } });
    expect(submit).not.toBeDisabled();
  });

  it('on success calls verifyEmail(email, code), clears sessionStorage, and navigates to /', async () => {
    sessionStorage.setItem('turnocero_pending_verify_email', 'pending@b.com');
    const verifyEmail = vi.fn().mockResolvedValue(undefined);
    renderVerify({ verifyEmail });

    fireEvent.change(screen.getByPlaceholderText('••••••'), { target: { value: '555555' } });
    fireEvent.click(screen.getByRole('button', { name: /verificar/i }));

    await waitFor(() => expect(verifyEmail).toHaveBeenCalledWith('pending@b.com', '555555'));
    expect(navigateMock).toHaveBeenCalledWith('/');
    expect(sessionStorage.getItem('turnocero_pending_verify_email')).toBeNull();
  });

  it('shows the API error message on failure', async () => {
    const verifyEmail = vi.fn().mockRejectedValue({
      response: { data: { message: 'Código inválido o expirado' } },
    });
    renderVerify({
      initialEntry: { pathname: '/verificar-email', state: { email: 'a@b.com' } },
      verifyEmail,
    });

    fireEvent.change(screen.getByPlaceholderText('••••••'), { target: { value: '999999' } });
    fireEvent.click(screen.getByRole('button', { name: /verificar/i }));

    expect(await screen.findByText('Código inválido o expirado')).toBeInTheDocument();
  });

  it('Resend button triggers requestEmailVerification and starts a cooldown', async () => {
    const requestEmailVerification = vi.fn().mockResolvedValue(undefined);
    renderVerify({
      initialEntry: { pathname: '/verificar-email', state: { email: 'a@b.com' } },
      requestEmailVerification,
    });

    const resendBtn = screen.getByRole('button', { name: /reenviar c[oó]digo/i });
    fireEvent.click(resendBtn);

    await waitFor(() => expect(requestEmailVerification).toHaveBeenCalledWith('a@b.com'));
    expect(await screen.findByText(/si la cuenta existe/i)).toBeInTheDocument();
    // Cooldown triggers a "Reenviar en Ns" label.
    expect(screen.getByRole('button', { name: /reenviar en/i })).toBeDisabled();
  });
});
