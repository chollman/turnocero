import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

import EventoInscripciones from './EventoInscripciones';
import { useAuth } from '../../context/AuthContext';

function renderWithRoute({ user, eventoId = 'e1' } = {}) {
  useAuth.mockReturnValue({ user, loading: false });
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/eventos/${eventoId}/inscripciones`]}>
        <Routes>
          <Route path="/eventos/:id/inscripciones" element={<EventoInscripciones />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

function makeReg(overrides = {}) {
  return {
    _id: overrides._id || `r${Math.random()}`,
    status: overrides.status || 'pending',
    submittedAt: overrides.submittedAt || new Date().toISOString(),
    reviewedAt: overrides.reviewedAt || null,
    adminNotes: '',
    user: overrides.user || {
      _id: 'u1',
      username: 'jugador1',
      displayName: 'Jugador 1',
      avatar: { url: '', publicId: '' },
    },
    comprobante: null,
    ...overrides,
  };
}

beforeEach(() => {
  server.use(
    http.get('/api/eventos/:id/inscripciones', () =>
      HttpResponse.json({
        evento: { _id: 'e1', title: 'Mi Evento', status: 'open' },
        registrations: [
          makeReg({ status: 'pending', user: { _id: 'u1', username: 'pending1', displayName: '', avatar: { url: '', publicId: '' } } }),
          makeReg({ status: 'confirmed', user: { _id: 'u2', username: 'confirmed1', displayName: '', avatar: { url: '', publicId: '' } } }),
          makeReg({ status: 'rejected', user: { _id: 'u3', username: 'rejected1', displayName: '', avatar: { url: '', publicId: '' } } }),
        ],
        counts: { total: 3, pending: 1, confirmed: 1, rejected: 1 },
      }),
    ),
  );
});

describe('<EventoInscripciones>', () => {
  it('non-admin gets redirected to /', () => {
    renderWithRoute({ user: { _id: 'me', isAdmin: false } });
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('admin sees all registrations rendered', async () => {
    renderWithRoute({ user: { _id: 'admin', isAdmin: true } });
    expect(await screen.findByText('pending1')).toBeInTheDocument();
    expect(screen.getByText('confirmed1')).toBeInTheDocument();
    expect(screen.getByText('rejected1')).toBeInTheDocument();
  });

  it('shows the evento title in the page header', async () => {
    renderWithRoute({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('pending1');
    // The title may appear in the document title (Helmet) AND the visible header.
    const matches = screen.getAllByText(/Mi Evento/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('regression: each registration\'s user is rendered (no ghost avatars when API returns proper users)', async () => {
    renderWithRoute({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('pending1');
    // GhostIcon (used for deleted users) renders as an SVG inside a span with
    // aria-label="Usuario eliminado". For real users it should NOT appear.
    expect(screen.queryByLabelText('Usuario eliminado')).not.toBeInTheDocument();
  });
});
