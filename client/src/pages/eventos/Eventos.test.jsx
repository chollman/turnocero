import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
});
