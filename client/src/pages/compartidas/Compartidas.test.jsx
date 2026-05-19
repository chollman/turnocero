import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../context/SiteConfigContext', () => ({ useSiteConfig: vi.fn() }));

// Heavy children — stubbed with minimal callbacks for focused feed-logic testing.
vi.mock('./CompartidaCard', () => ({
  default: ({ post, onDeleted, onUpdated }) => (
    <div data-testid="compartida-card">
      {post.body}
      <button onClick={() => onDeleted?.(post._id)}>borrar-{post._id}</button>
      <button onClick={() => onUpdated?.({ ...post, body: `${post.body  }-editado` })}>
        editar-{post._id}
      </button>
    </div>
  ),
}));
vi.mock('./CreateCompartidaForm', () => ({
  default: ({ onCreated, onCancel }) => (
    <div data-testid="create-form">
      <button
        onClick={() =>
          onCreated?.({
            _id: 'npost',
            body: 'Nuevo post',
            images: [],
            likes: [],
            privacy: 'public',
            author: { _id: 'a1', username: 'a', avatar: { url: '', publicId: '' } },
            createdAt: new Date().toISOString(),
          })
        }
      >
        crear
      </button>
      <button onClick={() => onCancel?.()}>cancelar-form</button>
    </div>
  ),
}));
vi.mock('./CompartidasSidebar', () => ({ default: () => null }));
vi.mock('./BgWatchHomeWidget', () => ({ default: () => null }));

import Compartidas from './Compartidas';
import { useAuth } from '../../context/AuthContext';
import { useSiteConfig } from '../../context/SiteConfigContext';

function renderPage({ user = { _id: 'me', username: 'me' } } = {}) {
  useAuth.mockReturnValue({ user });
  useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <Compartidas />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

function makePost(overrides = {}) {
  return {
    _id: overrides._id || `c${Math.random()}`,
    body: overrides.body || 'Post body',
    privacy: overrides.privacy || 'public',
    author: { _id: 'a1', username: 'auth', avatar: { url: '', publicId: '' } },
    likes: [],
    images: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  server.use(
    http.get('/api/compartidas', () =>
      HttpResponse.json({
        compartidas: [makePost({ body: 'Hello' }), makePost({ body: 'World' })],
        featured: makePost({ body: 'Featured' }),
        page: 1,
        pages: 2,
        total: 12,
      }),
    ),
  );
});

describe('<Compartidas>', () => {
  it('loads the feed and renders both posts + featured', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByTestId('compartida-card').length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('World')).toBeInTheDocument();
  });

  it('renders empty state gracefully when API returns no posts', async () => {
    server.use(
      http.get('/api/compartidas', () =>
        HttpResponse.json({ compartidas: [], featured: null, page: 1, pages: 1, total: 0 }),
      ),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('compartida-card')).not.toBeInTheDocument();
    });
  });

  it('handles a 500 silently and stops the loading indicator', async () => {
    server.use(http.get('/api/compartidas', () => HttpResponse.json({}, { status: 500 })));
    renderPage();
    // No crash; tab/header still renders
    await waitFor(() => {
      // After the failed fetch, loading flag goes false; no cards.
      expect(screen.queryByTestId('compartida-card')).not.toBeInTheDocument();
    });
  });

  it('authenticated user sees the "+ Nueva compartida" toggle button', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('compartida-card').length).toBeGreaterThanOrEqual(2));
    expect(screen.getByRole('button', { name: /nueva compartida/i })).toBeInTheDocument();
  });

  it('clicking "+ Nueva compartida" shows the create form', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('compartida-card').length).toBeGreaterThanOrEqual(1));
    fireEvent.click(screen.getByRole('button', { name: /nueva compartida/i }));
    expect(screen.getByTestId('create-form')).toBeInTheDocument();
    // Button label flips to "✕ Cancelar" (the header toggle)
    expect(screen.getByRole('button', { name: '✕ Cancelar' })).toBeInTheDocument();
  });

  it('clicking the toggle again hides the create form', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('compartida-card').length).toBeGreaterThanOrEqual(1));
    fireEvent.click(screen.getByRole('button', { name: /nueva compartida/i }));
    expect(screen.getByTestId('create-form')).toBeInTheDocument();
    // Click the header toggle (exact "✕ Cancelar"), not the form's "cancelar-form"
    fireEvent.click(screen.getByRole('button', { name: '✕ Cancelar' }));
    expect(screen.queryByTestId('create-form')).not.toBeInTheDocument();
  });

  it('handleCreated: submitting the form prepends the new post and hides the form', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('compartida-card').length).toBeGreaterThanOrEqual(2));
    fireEvent.click(screen.getByRole('button', { name: /nueva compartida/i }));
    fireEvent.click(screen.getByRole('button', { name: 'crear' }));
    await waitFor(() => expect(screen.getByText('Nuevo post')).toBeInTheDocument());
    expect(screen.queryByTestId('create-form')).not.toBeInTheDocument();
  });

  it('handleDeleted: clicking delete removes the post from the feed', async () => {
    const known = makePost({ _id: 'cDEL', body: 'A borrar' });
    server.use(
      http.get('/api/compartidas', () =>
        HttpResponse.json({
          compartidas: [known, makePost({ body: 'Keeper' })],
          featured: null,
          page: 1,
          pages: 1,
          total: 2,
        }),
      ),
    );
    renderPage();
    await screen.findByText('A borrar');
    fireEvent.click(screen.getByRole('button', { name: 'borrar-cDEL' }));
    await waitFor(() => expect(screen.queryByText('A borrar')).not.toBeInTheDocument());
    expect(screen.getByText('Keeper')).toBeInTheDocument();
  });

  it('handleDeleted: deleting the featured post removes it from the feed header', async () => {
    const feat = makePost({ _id: 'cFEAT', body: 'Featured post' });
    server.use(
      http.get('/api/compartidas', () =>
        HttpResponse.json({
          compartidas: [makePost({ body: 'Normal' })],
          featured: feat,
          page: 1,
          pages: 1,
          total: 2,
        }),
      ),
    );
    renderPage();
    await screen.findByText('Featured post');
    fireEvent.click(screen.getByRole('button', { name: 'borrar-cFEAT' }));
    await waitFor(() => expect(screen.queryByText('Featured post')).not.toBeInTheDocument());
  });

  it('handleUpdated: editing a post updates its body in the feed', async () => {
    const post = makePost({ _id: 'cUPD', body: 'Original' });
    server.use(
      http.get('/api/compartidas', () =>
        HttpResponse.json({
          compartidas: [post],
          featured: null,
          page: 1,
          pages: 1,
          total: 1,
        }),
      ),
    );
    renderPage();
    await screen.findByText('Original');
    fireEvent.click(screen.getByRole('button', { name: 'editar-cUPD' }));
    await waitFor(() => expect(screen.getByText('Original-editado')).toBeInTheDocument());
  });

  it('guest (no user) sees "Registrate para compartir" in empty state', async () => {
    server.use(
      http.get('/api/compartidas', () =>
        HttpResponse.json({ compartidas: [], featured: null, page: 1, pages: 1, total: 0 }),
      ),
    );
    renderPage({ user: null });
    await waitFor(() => expect(screen.queryByTestId('compartida-card')).not.toBeInTheDocument());
    expect(screen.getByText(/registrate para compartir/i)).toBeInTheDocument();
  });

  it('user sees "+ Publicar compartida" button in empty state', async () => {
    server.use(
      http.get('/api/compartidas', () =>
        HttpResponse.json({ compartidas: [], featured: null, page: 1, pages: 1, total: 0 }),
      ),
    );
    renderPage();
    await waitFor(() => expect(screen.queryByTestId('compartida-card')).not.toBeInTheDocument());
    const publishBtn = screen.getByRole('button', { name: /publicar compartida/i });
    expect(publishBtn).toBeInTheDocument();
    fireEvent.click(publishBtn);
    expect(screen.getByTestId('create-form')).toBeInTheDocument();
  });

  it('"Ver más compartidas" loads the next page and appends', async () => {
    server.use(
      http.get('/api/compartidas', ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        if (page === 2)
          return HttpResponse.json({
            compartidas: [makePost({ body: 'Página 2' })],
            featured: null,
            page: 2,
            pages: 2,
            total: 3,
          });
        return HttpResponse.json({
          compartidas: [makePost({ body: 'Página 1' })],
          featured: null,
          page: 1,
          pages: 2,
          total: 3,
        });
      }),
    );
    renderPage();
    await screen.findByText('Página 1');
    expect(screen.getByRole('button', { name: /ver más compartidas/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver más compartidas/i }));
    await waitFor(() => expect(screen.getByText('Página 2')).toBeInTheDocument());
    expect(screen.getByText('Página 1')).toBeInTheDocument();
  });
});
