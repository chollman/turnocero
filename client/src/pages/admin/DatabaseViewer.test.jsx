import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

const useAuthMock = vi.fn();
vi.mock('../../context/AuthContext', () => ({ useAuth: () => useAuthMock() }));
vi.mock('./DatabaseSkeleton', () => ({ default: () => <div data-testid="db-skeleton" /> }));

import DatabaseViewer from './DatabaseViewer';

function renderViewer() {
  return render(
    <MemoryRouter>
      <DatabaseViewer />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthMock.mockReturnValue({
    user: { _id: 'admin', username: 'admin' },
    isActuallyAdmin: true,
  });
  server.use(
    http.get('/api/admin/collections', () =>
      HttpResponse.json(['users', 'tables', 'compartidas']),
    ),
    http.get('/api/admin/collections/:name', () =>
      HttpResponse.json({
        docs: [
          { _id: 'u1', username: 'alice', isAdmin: false },
          { _id: 'u2', username: 'bob', isAdmin: true },
        ],
        page: 1,
        pages: 1,
        total: 2,
      }),
    ),
  );
});

describe('<DatabaseViewer>', () => {
  it('redirects when user is not actually admin', () => {
    useAuthMock.mockReturnValueOnce({
      user: { _id: 'u1' },
      isActuallyAdmin: false,
    });
    const { container } = renderViewer();
    expect(container.querySelector('h1')).toBeNull();
  });

  it('renders page header for admins', async () => {
    renderViewer();
    expect(screen.getByText('Base de datos')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'users' })).toBeInTheDocument();
    });
  });

  it('renders collection tabs after fetching /admin/collections', async () => {
    renderViewer();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'users' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'tables' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'compartidas' })).toBeInTheDocument();
    });
  });

  it('renders table data once active collection is loaded', async () => {
    renderViewer();
    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
    });
  });

  it('shows the search input and clear button', async () => {
    renderViewer();
    await waitFor(() => screen.getByText('alice'));
    const search = screen.getByPlaceholderText(/buscar en la colección/i);
    fireEvent.change(search, { target: { value: 'alice' } });
    expect(search).toHaveValue('alice');
    // Clear button appears
    const clearBtn = screen.getByText('✕');
    fireEvent.click(clearBtn);
    expect(search).toHaveValue('');
  });

  it('renders Admin toggle column for users collection', async () => {
    renderViewer();
    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
    });
    // Header "Admin" + two toggle buttons (Admin / Admin ✓)
    expect(screen.getByRole('columnheader', { name: 'Admin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Admin ✓' })).toBeInTheDocument();
  });

  it('handles empty collection state', async () => {
    server.use(
      http.get('/api/admin/collections/:name', () =>
        HttpResponse.json({ docs: [], page: 1, pages: 1, total: 0 }),
      ),
    );
    renderViewer();
    await waitFor(() => {
      expect(screen.getByText(/la colección está vacía/i)).toBeInTheDocument();
    });
  });

  it('shows error when /admin/collections fails', async () => {
    server.use(
      http.get('/api/admin/collections', () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );
    renderViewer();
    await waitFor(() => {
      expect(screen.getByText(/no se pudieron cargar las colecciones/i)).toBeInTheDocument();
    });
  });

  it('disables the admin toggle for the current user', async () => {
    server.use(
      http.get('/api/admin/collections/:name', () =>
        HttpResponse.json({
          docs: [{ _id: 'admin', username: 'admin', isAdmin: true }],
          page: 1,
          pages: 1,
          total: 1,
        }),
      ),
    );
    renderViewer();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Admin ✓' })).toBeInTheDocument();
    });
    const btn = screen.getByRole('button', { name: 'Admin ✓' });
    expect(btn).toBeDisabled();
  });

  describe('debounce', () => {
    it('does NOT request the collection with the new search before the 300ms debounce settles', async () => {
      const calls = [];
      server.use(
        http.get('/api/admin/collections/:name', ({ request }) => {
          calls.push(new URL(request.url).searchParams.get('search'));
          return HttpResponse.json({ docs: [], page: 1, pages: 1, total: 0 });
        }),
      );
      // Render con timers reales — esperamos a que cargue el listado de colecciones y aparezca el input.
      renderViewer();
      const input = await screen.findByPlaceholderText(/buscar en la colección/i);
      await waitFor(() => expect(calls.length).toBeGreaterThanOrEqual(1));
      const baseline = calls.length;
      expect(calls.at(-1)).toBeNull();

      // Cambiamos a fake timers para controlar el debounce.
      vi.useFakeTimers({ shouldAdvanceTime: false });
      try {
        fireEvent.change(input, { target: { value: 'foo' } });
        // Antes del delay: no debe haber un nuevo request.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(150);
        });
        expect(calls.length).toBe(baseline);

        // Tras los 300ms → llega request con ?search=foo.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(300);
        });
        expect(calls.length).toBe(baseline + 1);
        expect(calls.at(-1)).toBe('foo');
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
