import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import CreateTable from './CreateTable';

beforeEach(() => {
  navigateMock.mockReset();
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
