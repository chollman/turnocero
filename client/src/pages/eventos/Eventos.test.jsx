import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

vi.mock('./EventoCard', () => ({
  default: ({ evento }) => <div data-testid="evento-card">{evento.title}</div>,
}));

import Eventos from './Eventos';
import { useAuth } from '../../context/AuthContext';

function renderPage({ user = { _id: 'me', username: 'me' } } = {}) {
  useAuth.mockReturnValue({ user });
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <Eventos />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

function makeEvento(overrides = {}) {
  return {
    _id: overrides._id || `e${Math.random()}`,
    title: overrides.title || 'Evento de prueba',
    description: '',
    eventDate: new Date(Date.now() + 14 * 86400000).toISOString(),
    location: 'BA',
    maxParticipants: 20,
    status: overrides.status || 'open',
    author: { _id: 'a1', username: 'admin', avatar: { url: '', publicId: '' } },
    fee: 0,
    ...overrides,
  };
}

beforeEach(() => {
  server.use(
    http.get('/api/eventos', () =>
      HttpResponse.json({
        eventos: [
          makeEvento({ title: 'Open House' }),
          makeEvento({ title: 'Torneo Nocturno', status: 'closed' }),
        ],
        page: 1,
        pages: 1,
        total: 2,
      }),
    ),
  );
});

describe('<Eventos>', () => {
  it('loads + renders the evento list', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByTestId('evento-card')).toHaveLength(2);
    });
    expect(screen.getByText('Open House')).toBeInTheDocument();
    expect(screen.getByText('Torneo Nocturno')).toBeInTheDocument();
  });

  it('regular users do not see the "Crear evento" admin button', async () => {
    renderPage({ user: { _id: 'me', isAdmin: false } });
    await screen.findByText('Open House');
    expect(screen.queryByRole('button', { name: /nuevo evento/i })).not.toBeInTheDocument();
  });

  it('admins see the "Crear evento" button', async () => {
    renderPage({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('Open House');
    expect(screen.getByRole('button', { name: /nuevo evento/i })).toBeInTheDocument();
  });

  it('shows the empty state when there are no eventos', async () => {
    server.use(
      http.get('/api/eventos', () =>
        HttpResponse.json({ eventos: [], page: 1, pages: 1, total: 0 }),
      ),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('evento-card')).not.toBeInTheDocument();
    });
  });

  it('admin clicking "Nuevo evento" reveals the create form', async () => {
    renderPage({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('Open House');
    fireEvent.click(screen.getByRole('button', { name: /nuevo evento/i }));
    expect(screen.getByPlaceholderText(/título del evento/i)).toBeInTheDocument();
  });

  it('clicking the toggle again ("Cancelar") hides the create form', async () => {
    renderPage({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('Open House');
    fireEvent.click(screen.getByRole('button', { name: /nuevo evento/i }));
    expect(screen.getByPlaceholderText(/título del evento/i)).toBeInTheDocument();
    // The top toggle now reads "Cancelar". There are two "Cancelar" buttons; pick the first
    // (the page-level toggle, not the form-level one).
    const cancels = screen.getAllByRole('button', { name: /^cancelar$/i });
    fireEvent.click(cancels[0]);
    expect(screen.queryByPlaceholderText(/título del evento/i)).not.toBeInTheDocument();
  });

  it('shows skeletons while loading', () => {
    server.use(
      http.get('/api/eventos', async () => {
        await new Promise((r) => { setTimeout(r, 50); });
        return HttpResponse.json({ eventos: [], page: 1, pages: 1 });
      }),
    );
    renderPage();
    expect(screen.queryByTestId('evento-card')).not.toBeInTheDocument();
  });

  it('admin: CreateForm validates that title is required', async () => {
    renderPage({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('Open House');
    fireEvent.click(screen.getByRole('button', { name: /nuevo evento/i }));
    // Submit without filling in a title
    fireEvent.submit(screen.getByPlaceholderText(/título del evento/i).closest('form'));
    expect(screen.getByText(/el título es obligatorio/i)).toBeInTheDocument();
  });

  it('admin: CreateForm submits and prepends the new evento', async () => {
    const newEvento = makeEvento({ _id: 'eNEW', title: 'Festival 2025' });
    server.use(
      http.post('/api/eventos', () => HttpResponse.json(newEvento)),
    );
    renderPage({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('Open House');
    fireEvent.click(screen.getByRole('button', { name: /nuevo evento/i }));
    fireEvent.change(screen.getByPlaceholderText(/título del evento/i), { target: { value: 'Festival 2025' } });
    fireEvent.submit(screen.getByPlaceholderText(/título del evento/i).closest('form'));
    await waitFor(() => expect(screen.getByText('Festival 2025')).toBeInTheDocument());
    // Form should be hidden after successful create
    expect(screen.queryByPlaceholderText(/título del evento/i)).not.toBeInTheDocument();
  });

  it('admin: CreateForm shows API error message on failure', async () => {
    server.use(
      http.post('/api/eventos', () => HttpResponse.json({ message: 'Error del servidor' }, { status: 500 })),
    );
    renderPage({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('Open House');
    fireEvent.click(screen.getByRole('button', { name: /nuevo evento/i }));
    fireEvent.change(screen.getByPlaceholderText(/título del evento/i), { target: { value: 'Evento fallido' } });
    fireEvent.submit(screen.getByPlaceholderText(/título del evento/i).closest('form'));
    await waitFor(() => expect(screen.getByText(/error del servidor/i)).toBeInTheDocument());
  });

  it('admin: status filter buttons are visible', async () => {
    renderPage({ user: { _id: 'admin', isAdmin: true } });
    await screen.findByText('Open House');
    // STATUS_OPTIONS: Todos, Abiertos, Cerrados, Borradores, Cancelados
    expect(screen.getByRole('button', { name: /todos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /abiertos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cerrados/i })).toBeInTheDocument();
  });

  it('admin: clicking a status filter button refetches with that filter', async () => {
    let lastStatus = '';
    server.use(
      http.get('/api/eventos', ({ request }) => {
        const url = new URL(request.url);
        lastStatus = url.searchParams.get('status') || '';
        return HttpResponse.json({ eventos: [], page: 1, pages: 1, total: 0 });
      }),
    );
    renderPage({ user: { _id: 'admin', isAdmin: true } });
    // Wait for initial load
    await waitFor(() => expect(lastStatus).toBe(''));
    fireEvent.click(screen.getByRole('button', { name: /abiertos/i }));
    await waitFor(() => expect(lastStatus).toBe('open'));
  });

  it('"Ver más eventos" loads the next page and appends events', async () => {
    server.use(
      http.get('/api/eventos', ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        if (page === 2) return HttpResponse.json({ eventos: [makeEvento({ title: 'Evento Página 2' })], page: 2, pages: 2, total: 3 });
        return HttpResponse.json({ eventos: [makeEvento({ title: 'Evento Página 1' })], page: 1, pages: 2, total: 3 });
      }),
    );
    renderPage();
    await screen.findByText('Evento Página 1');
    expect(screen.getByRole('button', { name: /ver más eventos/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver más eventos/i }));
    await waitFor(() => expect(screen.getByText('Evento Página 2')).toBeInTheDocument());
    expect(screen.getByText('Evento Página 1')).toBeInTheDocument();
  });
});
