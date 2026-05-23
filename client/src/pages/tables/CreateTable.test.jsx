import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

// Mock de PlaceAutocomplete — su test propio cubre el comportamiento.
// AddressMap fue removido del form de creación (2026-05).
vi.mock('../../components/shared/PlaceAutocomplete', () => ({
  default: ({ value, onChange, placeholder }) => (
    <input
      data-testid="place-autocomplete"
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

import CreateTable from './CreateTable';
import { useAuth } from '../../context/AuthContext';

beforeEach(() => {
  navigateMock.mockReset();
  // Default: usuario sin direccion. Tests específicos sobreescriben.
  useAuth.mockReturnValue({ user: { _id: 'me', username: 'me' } });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <CreateTable />
    </MemoryRouter>,
  );
}

describe('<CreateTable>', () => {
  it('renders heading + form fields', () => {
    renderPage();
    expect(screen.getByText(/convoc[aá] una partida/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/buscá un juego/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear|convocar|publicar|crear mesa/i })).toBeInTheDocument();
  });

  it('shows BGG suggestions after typing ≥3 characters', async () => {
    server.use(
      http.get('/api/bgg/search', () => HttpResponse.json([
        { id: 1, name: 'Catan', year: 1995, thumbnail: null },
        { id: 2, name: 'Carcassonne', year: 2000, thumbnail: null },
      ])),
    );
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/buscá un juego/i), { target: { value: 'cat' } });
    await waitFor(() => {
      expect(screen.getByText('Catan')).toBeInTheDocument();
      expect(screen.getByText('Carcassonne')).toBeInTheDocument();
    });
  });

  it('shows "Sin resultados" when BGG returns empty', async () => {
    server.use(http.get('/api/bgg/search', () => HttpResponse.json([])));
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/buscá un juego/i), { target: { value: 'xyz' } });
    await waitFor(() => {
      expect(screen.getByText(/sin resultados/i)).toBeInTheDocument();
    });
  });

  it('selecting a suggestion fills the input and locks the game', async () => {
    server.use(
      http.get('/api/bgg/search', () =>
        HttpResponse.json([{ id: 1, name: 'Catan', year: 1995, thumbnail: null }]),
      ),
      http.get('/api/bgg/game/:id', () =>
        HttpResponse.json({ id: 1, name: 'Catan (full)', year: 1995, image: null, thumbnail: null }),
      ),
    );
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/buscá un juego/i), { target: { value: 'cat' } });
    const suggestion = await screen.findByText('Catan');
    fireEvent.mouseDown(suggestion);
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/buscá un juego/i);
      expect(input.value).toBe('Catan (full)');
    });
  });

  it('submit without a game selected shows the validation error', () => {
    renderPage();
    const form = screen.getByPlaceholderText(/buscá un juego/i).closest('form');
    fireEvent.submit(form);
    expect(screen.getByText(/seleccion[aá] un juego/i)).toBeInTheDocument();
  });

  it('successful submit creates the table and navigates to /mesas/:id', async () => {
    server.use(
      http.get('/api/bgg/search', () =>
        HttpResponse.json([{ id: 1, name: 'Catan', year: 1995, thumbnail: null }]),
      ),
      http.get('/api/bgg/game/:id', () =>
        HttpResponse.json({ id: 1, name: 'Catan', year: 1995, image: null, thumbnail: null }),
      ),
      http.post('/api/tables', () =>
        HttpResponse.json({ _id: 'newtable-id', boardGame: 'Catan' }, { status: 201 }),
      ),
    );
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/buscá un juego/i), { target: { value: 'cat' } });
    const suggestion = await screen.findByText('Catan');
    fireEvent.mouseDown(suggestion);
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/buscá un juego/i);
      expect(input.value).toBe('Catan');
    });

    const form = screen.getByPlaceholderText(/buscá un juego/i).closest('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/mesas/newtable-id');
    });
  });
});

describe('<CreateTable> — Ubicación (opcional, sin mapa)', () => {
  it('no renderiza un mapa en el form de creación', () => {
    renderPage();
    // AddressMap fue removido del flujo de creación.
    expect(screen.queryByTestId('address-map')).not.toBeInTheDocument();
  });

  it('muestra label "Ubicación" con el hint "(opcional)"', () => {
    renderPage();
    expect(screen.getByText('Ubicación')).toBeInTheDocument();
    expect(screen.getByText(/\(opcional\)/)).toBeInTheDocument();
  });

  it('cuando el user tiene direccion en el perfil, muestra hint de fallback con el texto', () => {
    useAuth.mockReturnValue({
      user: { _id: 'me', username: 'me', direccion: { texto: 'Av. Corrientes 1234', lat: -34.6, lng: -58.4 } },
    });
    renderPage();
    expect(screen.getByText(/usamos la dirección de tu perfil/i)).toBeInTheDocument();
    expect(screen.getByText('Av. Corrientes 1234')).toBeInTheDocument();
  });

  it('cuando el user NO tiene direccion, muestra link al perfil', () => {
    useAuth.mockReturnValue({ user: { _id: 'me', username: 'me' } });
    renderPage();
    expect(screen.getByText(/la mesa se publica sin ubicación/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /agregá una dirección a tu perfil/i })).toHaveAttribute('href', '/perfil');
  });

  it('cuando hay ?evento=<id>, no renderiza la sección de Ubicación', () => {
    render(
      <MemoryRouter initialEntries={['/mesas/crear?evento=ev123']}>
        <CreateTable />
      </MemoryRouter>,
    );
    // La sección entera (label + input + hint) se omite — la ubicación se
    // hereda del evento server-side, no hay nada que mostrar.
    expect(screen.queryByText('Ubicación')).not.toBeInTheDocument();
    expect(screen.queryByTestId('place-autocomplete')).not.toBeInTheDocument();
  });

  it('cuando hay ?evento= con eventDate en nav state, swap el datetime-local por un time picker', () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/mesas/crear',
            search: '?evento=ev123',
            state: { eventDate: '2030-06-15T16:00:00.000Z' },
          },
        ]}
      >
        <CreateTable />
      </MemoryRouter>,
    );
    // No hay "Fecha y hora" — solo "Hora *"
    expect(screen.queryByLabelText(/fecha y hora/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Hora \*$/)).toBeInTheDocument();
  });
});

describe('<CreateTable> — debounce BGG search', () => {
  it('does NOT call /api/bgg/search while typing — only after the 400ms debounce settles', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    try {
      let callCount = 0;
      server.use(
        http.get('/api/bgg/search', () => {
          callCount += 1;
          return HttpResponse.json([]);
        }),
      );
      renderPage();

      const input = screen.getByPlaceholderText(/buscá un juego/i);
      fireEvent.change(input, { target: { value: 'cat' } });
      // Antes del delay no debe haber pegado al backend.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      expect(callCount).toBe(0);

      // Más cambios dentro del delay → reinicia el timer.
      fireEvent.change(input, { target: { value: 'catan' } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(callCount).toBe(0);

      // Tras los 400ms desde el último cambio → fetch dispara una sola vez.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
      expect(callCount).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
