import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

  it('shows filter buttons (Todos, Pendientes, Confirmados, Rechazados)', async () => {
    renderWithRoute({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('pending1');
    expect(screen.getByRole('button', { name: /todos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pendientes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmados/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rechazados/i })).toBeInTheDocument();
  });

  it('clicking Pendientes filter shows only pending registrations', async () => {
    renderWithRoute({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('pending1');
    fireEvent.click(screen.getByRole('button', { name: /^pendientes/i }));
    expect(screen.getByText('pending1')).toBeInTheDocument();
    expect(screen.queryByText('confirmed1')).not.toBeInTheDocument();
    expect(screen.queryByText('rejected1')).not.toBeInTheDocument();
  });

  it('clicking Confirmados filter shows only confirmed registrations', async () => {
    renderWithRoute({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('confirmed1');
    fireEvent.click(screen.getByRole('button', { name: /^confirmados/i }));
    expect(screen.getByText('confirmed1')).toBeInTheDocument();
    expect(screen.queryByText('pending1')).not.toBeInTheDocument();
  });

  it('clicking "Acciones" expands the row and shows Confirmar / Rechazar buttons', async () => {
    renderWithRoute({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('pending1');
    const accionBtns = screen.getAllByRole('button', { name: /^acciones$/i });
    fireEvent.click(accionBtns[0]);
    expect(screen.getByRole('button', { name: /confirmar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rechazar/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/notas internas/i)).toBeInTheDocument();
  });

  it('clicking "Cerrar" on expanded row collapses the actions panel', async () => {
    renderWithRoute({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('pending1');
    const accionBtns = screen.getAllByRole('button', { name: /^acciones$/i });
    fireEvent.click(accionBtns[0]);
    expect(screen.getByRole('button', { name: /confirmar/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^cerrar$/i }));
    expect(screen.queryByRole('button', { name: /confirmar/i })).not.toBeInTheDocument();
  });

  it('confirming a registration calls PATCH and collapses the row', async () => {
    server.use(
      http.patch('/api/eventos/:id/inscripciones/:userId/confirmar', () =>
        HttpResponse.json({ ok: true }),
      ),
    );
    renderWithRoute({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('pending1');
    const accionBtns = screen.getAllByRole('button', { name: /^acciones$/i });
    fireEvent.click(accionBtns[0]);
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /confirmar/i })).not.toBeInTheDocument(),
    );
  });

  it('rejecting a registration calls PATCH and collapses the row', async () => {
    server.use(
      http.patch('/api/eventos/:id/inscripciones/:userId/rechazar', () =>
        HttpResponse.json({ ok: true }),
      ),
    );
    renderWithRoute({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('pending1');
    const accionBtns = screen.getAllByRole('button', { name: /^acciones$/i });
    fireEvent.click(accionBtns[0]);
    fireEvent.click(screen.getByRole('button', { name: /rechazar/i }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /rechazar/i })).not.toBeInTheDocument(),
    );
  });

  it('shows API error message when confirm fails', async () => {
    server.use(
      http.patch('/api/eventos/:id/inscripciones/:userId/confirmar', () =>
        HttpResponse.json({ message: 'No se puede confirmar' }, { status: 400 }),
      ),
    );
    renderWithRoute({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('pending1');
    const accionBtns = screen.getAllByRole('button', { name: /^acciones$/i });
    fireEvent.click(accionBtns[0]);
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() =>
      expect(screen.getByText(/no se puede confirmar/i)).toBeInTheDocument(),
    );
  });

  it('shows API error message when reject fails', async () => {
    server.use(
      http.patch('/api/eventos/:id/inscripciones/:userId/rechazar', () =>
        HttpResponse.json({ message: 'Error al rechazar' }, { status: 400 }),
      ),
    );
    renderWithRoute({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('pending1');
    const accionBtns = screen.getAllByRole('button', { name: /^acciones$/i });
    fireEvent.click(accionBtns[0]);
    fireEvent.click(screen.getByRole('button', { name: /rechazar/i }));
    await waitFor(() =>
      expect(screen.getByText(/error al rechazar/i)).toBeInTheDocument(),
    );
  });

  it('shows "not found" state on 404', async () => {
    server.use(
      http.get('/api/eventos/:id/inscripciones', () =>
        HttpResponse.json({ message: 'Not found' }, { status: 404 }),
      ),
    );
    renderWithRoute({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText(/evento no encontrado/i);
    expect(screen.getByRole('link', { name: /volver a eventos/i })).toBeInTheDocument();
  });

  it('shows empty state when the active filter has no matching registrations', async () => {
    server.use(
      http.get('/api/eventos/:id/inscripciones', () =>
        HttpResponse.json({
          evento: { _id: 'e1', title: 'Mi Evento', status: 'open' },
          registrations: [
            makeReg({ status: 'confirmed', user: { _id: 'u2', username: 'confirmed1', displayName: '', avatar: { url: '', publicId: '' } } }),
          ],
          counts: { total: 1, pending: 0, confirmed: 1, rejected: 0 },
        }),
      ),
    );
    renderWithRoute({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('confirmed1');
    fireEvent.click(screen.getByRole('button', { name: /^pendientes/i }));
    expect(screen.getByText(/no hay inscripciones en esta categoría/i)).toBeInTheDocument();
  });

  it('registration with comprobante image shows a "Ver" link', async () => {
    server.use(
      http.get('/api/eventos/:id/inscripciones', () =>
        HttpResponse.json({
          evento: { _id: 'e1', title: 'Mi Evento', status: 'open' },
          registrations: [
            makeReg({
              status: 'pending',
              user: { _id: 'u1', username: 'jugador1', displayName: '', avatar: { url: '', publicId: '' } },
              comprobante: {
                url: 'https://example.com/comp.jpg',
                publicId: 'abc',
                resourceType: 'image',
                uploadedAt: new Date().toISOString(),
              },
            }),
          ],
          counts: { total: 1, pending: 1, confirmed: 0, rejected: 0 },
        }),
      ),
    );
    renderWithRoute({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('jugador1');
    expect(screen.getByRole('link', { name: /🖼 ver/i })).toBeInTheDocument();
  });

  it('registration with PDF comprobante shows a "PDF" link', async () => {
    server.use(
      http.get('/api/eventos/:id/inscripciones', () =>
        HttpResponse.json({
          evento: { _id: 'e1', title: 'Mi Evento', status: 'open' },
          registrations: [
            makeReg({
              status: 'pending',
              user: { _id: 'u1', username: 'jugador1', displayName: '', avatar: { url: '', publicId: '' } },
              comprobante: {
                url: 'https://example.com/comp.pdf',
                publicId: 'abc',
                resourceType: 'raw',
                uploadedAt: new Date().toISOString(),
              },
            }),
          ],
          counts: { total: 1, pending: 1, confirmed: 0, rejected: 0 },
        }),
      ),
    );
    renderWithRoute({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('jugador1');
    expect(screen.getByRole('link', { name: /📄 pdf/i })).toBeInTheDocument();
  });

  it('admin notes textarea is editable in expanded row', async () => {
    renderWithRoute({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('pending1');
    const accionBtns = screen.getAllByRole('button', { name: /^acciones$/i });
    fireEvent.click(accionBtns[0]);
    const textarea = screen.getByPlaceholderText(/notas internas/i);
    fireEvent.change(textarea, { target: { value: 'Pago verificado' } });
    expect(textarea.value).toBe('Pago verificado');
  });

  it('shows reviewedAt date when registration has been reviewed', async () => {
    const reviewDate = new Date('2025-12-01T10:00:00Z').toISOString();
    server.use(
      http.get('/api/eventos/:id/inscripciones', () =>
        HttpResponse.json({
          evento: { _id: 'e1', title: 'Mi Evento', status: 'open' },
          registrations: [
            makeReg({
              status: 'confirmed',
              reviewedAt: reviewDate,
              user: { _id: 'u2', username: 'revisado1', displayName: '', avatar: { url: '', publicId: '' } },
            }),
          ],
          counts: { total: 1, pending: 0, confirmed: 1, rejected: 0 },
        }),
      ),
    );
    renderWithRoute({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('revisado1');
    expect(screen.getByText(/revisada:/i)).toBeInTheDocument();
  });
});
