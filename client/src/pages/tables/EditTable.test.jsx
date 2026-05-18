import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import EditTable from './EditTable';
import { useAuth } from '../../context/AuthContext';

function makeTable(overrides = {}) {
  return {
    _id: 't1',
    boardGame: 'Catán',
    date: new Date(Date.now() + 7 * 86400000).toISOString(),
    maxPlayers: 4,
    players: [],
    location: 'Buenos Aires',
    description: 'Notas',
    host: { _id: 'host1', username: 'host1' },
    status: 'open',
    privacy: 'public',
    ...overrides,
  };
}

function renderEdit({ user = { _id: 'host1' }, id = 't1' } = {}) {
  useAuth.mockReturnValue({ user });
  return render(
    <MemoryRouter initialEntries={[`/mesas/${id}/editar`]}>
      <Routes>
        <Route path="/mesas/:id/editar" element={<EditTable />} />
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateMock.mockReset();
});

describe('<EditTable>', () => {
  it('non-host gets redirected to /', async () => {
    server.use(http.get('/api/tables/:id', () => HttpResponse.json(makeTable())));
    renderEdit({ user: { _id: 'me' } });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/');
    });
  });

  it('cancelled table redirects to /', async () => {
    server.use(http.get('/api/tables/:id', () => HttpResponse.json(makeTable({ status: 'cancelled' }))));
    renderEdit();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/');
    });
  });

  it('host sees the prefilled form fields', async () => {
    server.use(http.get('/api/tables/:id', () => HttpResponse.json(makeTable())));
    renderEdit();
    await waitFor(() => {
      expect(screen.getByText(/editar tu mesa/i)).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('Buenos Aires')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Notas')).toBeInTheDocument();
  });

  it('PUT /api/tables/:id on submit, then navigate home', async () => {
    server.use(
      http.get('/api/tables/:id', () => HttpResponse.json(makeTable())),
      http.put('/api/tables/:id', () => HttpResponse.json({ ok: true })),
    );
    renderEdit();
    await screen.findByText(/editar tu mesa/i);

    fireEvent.change(screen.getByDisplayValue('Buenos Aires'), { target: { value: 'Córdoba' } });
    const form = screen.getByDisplayValue('Córdoba').closest('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/');
    });
  });

  it('Cancel button calls DELETE after confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let deleteCalled = false;
    server.use(
      http.get('/api/tables/:id', () => HttpResponse.json(makeTable())),
      http.delete('/api/tables/:id', () => { deleteCalled = true; return HttpResponse.json({ ok: true }); }),
    );
    renderEdit();
    await screen.findByText(/editar tu mesa/i);

    const deleteBtn = screen.getByRole('button', { name: /eliminar mesa/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => expect(deleteCalled).toBe(true));
    expect(navigateMock).toHaveBeenCalledWith('/');
    confirmSpy.mockRestore();
  });
});
