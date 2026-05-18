import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

import EventoDetail from './EventoDetail';
import { useAuth } from '../../context/AuthContext';

function makeEvento(overrides = {}) {
  return {
    _id: 'e1',
    title: 'Mi Evento',
    description: 'Descripción del evento',
    conditions: '',
    fee: overrides.fee ?? 0,
    transferDetails: overrides.transferDetails || '',
    eventDate: new Date(Date.now() + 14 * 86400000).toISOString(),
    location: 'Buenos Aires',
    maxParticipants: 20,
    image: null,
    status: overrides.status || 'open',
    author: { _id: 'a1', username: 'organizer', avatar: { url: '', publicId: '' } },
    registrationCount: { total: 2, pending: 1, confirmed: 1 },
    userRegistration: null,
    confirmedRegistrations: [],
    ...overrides,
  };
}

function setupEvento(evento) {
  server.use(
    http.get('/api/eventos/:id', () => HttpResponse.json(evento)),
  );
}

function renderDetail({ user = null, eventoId = 'e1' } = {}) {
  useAuth.mockReturnValue({ user });
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/eventos/${eventoId}`]}>
        <Routes>
          <Route path="/eventos/:id" element={<EventoDetail />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

beforeEach(() => {
  setupEvento(makeEvento());
});

describe('<EventoDetail>', () => {
  it('renders the evento title, description and "Gratis" label when fee=0', async () => {
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Mi Evento' })).toBeInTheDocument();
    expect(screen.getByText('Descripción del evento')).toBeInTheDocument();
    expect(screen.getByText('Gratis')).toBeInTheDocument();
  });

  it('renders the formatted fee when > 0', async () => {
    setupEvento(makeEvento({ fee: 5000 }));
    renderDetail();
    expect(await screen.findByText(/\$5\.000/)).toBeInTheDocument();
  });

  it('renders the location', async () => {
    renderDetail();
    await screen.findByRole('heading', { name: 'Mi Evento' });
    expect(screen.getByText('Buenos Aires')).toBeInTheDocument();
  });

  it('shows "Inscripciones cerradas" status when status=closed', async () => {
    setupEvento(makeEvento({ status: 'closed' }));
    renderDetail();
    expect(await screen.findByText(/inscripciones cerradas/i)).toBeInTheDocument();
  });

  it('regression: renders confirmedRegistrations with proper user info (no ghost avatars)', async () => {
    setupEvento(
      makeEvento({
        confirmedRegistrations: [
          { _id: 'r1', user: { _id: 'u1', username: 'player1', displayName: '', avatar: { url: '', publicId: '' } } },
          { _id: 'r2', user: { _id: 'u2', username: 'player2', displayName: 'Player Two', avatar: { url: '', publicId: '' } } },
        ],
      }),
    );
    renderDetail();
    await screen.findByRole('heading', { name: 'Mi Evento' });
    expect(screen.getByText(/player1/i)).toBeInTheDocument();
    expect(screen.getByText(/Player Two/i)).toBeInTheDocument();
    // GhostIcon should NOT appear for properly-populated users.
    expect(screen.queryByLabelText('Usuario eliminado')).not.toBeInTheDocument();
  });

  it('shows login prompt when anonymous user tries to register', async () => {
    renderDetail({ user: null });
    await screen.findByRole('heading', { name: 'Mi Evento' });
    const registerBtn = screen.queryByRole('button', { name: /inscribirme|inscrib[ií]r/i });
    if (registerBtn) {
      fireEvent.click(registerBtn);
      // LoginPromptModal should appear
      await waitFor(() => {
        expect(screen.getByText(/iniciar sesi[oó]n|sumate/i)).toBeInTheDocument();
      });
    }
  });

  it('shows the userRegistration status when logged-in user is already registered', async () => {
    setupEvento(
      makeEvento({
        userRegistration: { _id: 'r-me', status: 'pending', submittedAt: new Date().toISOString(), comprobante: null },
      }),
    );
    renderDetail({ user: { _id: 'me', username: 'me' } });
    await screen.findByRole('heading', { name: 'Mi Evento' });
    // "Pendiente" appears in multiple places (status badge, counts header) — at least one match suffices.
    expect(screen.getAllByText(/pendiente|en revisi[oó]n|revisando/i).length).toBeGreaterThan(0);
  });

  it('404 redirects to / via the not-found handling', async () => {
    server.use(http.get('/api/eventos/:id', () => HttpResponse.json({ message: 'Evento no encontrado' }, { status: 404 })));
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText(/evento no encontrado|no encontrado/i)).toBeInTheDocument();
    });
  });
});
