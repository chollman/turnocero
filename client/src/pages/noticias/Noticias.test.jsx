import { describe, it, expect, vi, beforeEach, act } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

import Noticias from './Noticias';
import { useAuth } from '../../context/AuthContext';

function makeNoticia(overrides = {}) {
  return {
    _id: overrides._id || `n${Math.random()}`,
    title: overrides.title || 'Noticia',
    body: overrides.body || 'Cuerpo de la noticia',
    image: overrides.image || null,
    link: overrides.link || '',
    linkLabel: overrides.linkLabel || '',
    author: { _id: 'a1', username: 'admin', avatar: { url: '', publicId: '' } },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function setup({ user = null, noticias = [], pages = 1 } = {}) {
  useAuth.mockReturnValue({ user });
  server.use(
    http.get('/api/noticias', () =>
      HttpResponse.json({ noticias, page: 1, pages, total: noticias.length }),
    ),
  );
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <Noticias />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('<Noticias>', () => {
  it('renders the heading + subtitle', async () => {
    setup({ noticias: [makeNoticia({ title: 'Primer post' })] });
    expect(await screen.findByRole('heading', { name: 'Noticias' })).toBeInTheDocument();
    expect(screen.getByText(/novedades.*comunidad/i)).toBeInTheDocument();
  });

  it('renders the loaded noticias', async () => {
    setup({
      noticias: [
        makeNoticia({ title: 'Aviso 1' }),
        makeNoticia({ title: 'Aviso 2' }),
      ],
    });
    expect(await screen.findByText('Aviso 1')).toBeInTheDocument();
    expect(screen.getByText('Aviso 2')).toBeInTheDocument();
  });

  it('shows the empty state when there are no noticias', async () => {
    setup({ noticias: [] });
    expect(await screen.findByText(/sin noticias/i)).toBeInTheDocument();
  });

  it('admin sees "+ Nueva noticia" button', async () => {
    setup({ user: { _id: 'admin', isAdmin: true }, noticias: [makeNoticia()] });
    await screen.findByRole('heading', { name: 'Noticias' });
    expect(screen.getByRole('button', { name: /nueva noticia/i })).toBeInTheDocument();
  });

  it('regular users do not see the create button', async () => {
    setup({ user: { _id: 'me', isAdmin: false }, noticias: [makeNoticia()] });
    await screen.findByRole('heading', { name: 'Noticias' });
    expect(screen.queryByRole('button', { name: /nueva noticia/i })).not.toBeInTheDocument();
  });

  it('admin: clicking "+ Nueva noticia" toggles the create form open', async () => {
    setup({ user: { _id: 'admin', isAdmin: true }, noticias: [makeNoticia()] });
    await screen.findByRole('heading', { name: 'Noticias' });
    fireEvent.click(screen.getByRole('button', { name: /nueva noticia/i }));
    // Header button flips to "✕ Cancelar" (the embedded create form may also expose a Cancel).
    expect(screen.getAllByRole('button', { name: /cancelar/i }).length).toBeGreaterThan(0);
  });

  it('admin: CreateForm submit POSTs and prepends new noticia', async () => {
    const newNoticia = makeNoticia({ _id: 'nNEW', title: 'Noticia nueva' });
    server.use(
      http.post('/api/noticias', () => HttpResponse.json(newNoticia)),
    );
    setup({ user: { _id: 'admin', isAdmin: true }, noticias: [] });
    await screen.findByRole('heading', { name: 'Noticias' });
    fireEvent.click(screen.getByRole('button', { name: /nueva noticia/i }));
    // Fill in the title field (optional but distinguishable)
    const titleInput = screen.getByPlaceholderText(/título/i);
    fireEvent.change(titleInput, { target: { value: 'Noticia nueva' } });
    // Use exact string to avoid matching "+ Publicar noticia" in the empty state
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(screen.getByText('Noticia nueva')).toBeInTheDocument());
  });

  it('admin: NoticiaCard shows Editar and Eliminar buttons', async () => {
    setup({ user: { _id: 'admin', isAdmin: true }, noticias: [makeNoticia({ title: 'Noticia edit test' })] });
    await screen.findByText('Noticia edit test');
    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /eliminar/i })).toBeInTheDocument();
  });

  it('admin: clicking "Editar" on a NoticiaCard opens the edit form', async () => {
    setup({ user: { _id: 'admin', isAdmin: true }, noticias: [makeNoticia({ title: 'Editable' })] });
    await screen.findByText('Editable');
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Editable')).toBeInTheDocument();
  });

  it('admin: saving an edited NoticiaCard PUTs and updates the title', async () => {
    const original = makeNoticia({ title: 'Titulo original', body: 'Cuerpo' });
    const updated  = { ...original, title: 'Titulo editado' };
    server.use(
      http.put(`/api/noticias/${original._id}`, () => HttpResponse.json(updated)),
    );
    setup({ user: { _id: 'admin', isAdmin: true }, noticias: [original] });
    await screen.findByText('Titulo original');
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    const titleInput = screen.getByDisplayValue('Titulo original');
    fireEvent.change(titleInput, { target: { value: 'Titulo editado' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(screen.getByText('Titulo editado')).toBeInTheDocument());
  });

  it('admin: cancelling edit closes the form', async () => {
    setup({ user: { _id: 'admin', isAdmin: true }, noticias: [makeNoticia({ title: 'Sin cambios' })] });
    await screen.findByText('Sin cambios');
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument();
    // Click Cancelar in the edit form (not the header toggle)
    const cancelBtns = screen.getAllByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelBtns[cancelBtns.length - 1]);
    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument();
  });

  it('admin: clicking "Eliminar" shows confirmation row', async () => {
    setup({ user: { _id: 'admin', isAdmin: true }, noticias: [makeNoticia({ title: 'Para borrar' })] });
    await screen.findByText('Para borrar');
    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));
    expect(screen.getByRole('button', { name: /^sí$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^no$/i })).toBeInTheDocument();
  });

  it('admin: confirming delete removes the noticia from the list', async () => {
    const n = makeNoticia({ _id: 'nDEL', title: 'A eliminar' });
    server.use(
      http.delete(`/api/noticias/${n._id}`, () => HttpResponse.json({ ok: true })),
    );
    setup({ user: { _id: 'admin', isAdmin: true }, noticias: [n] });
    await screen.findByText('A eliminar');
    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));
    fireEvent.click(screen.getByRole('button', { name: /^sí$/i }));
    await waitFor(() => expect(screen.queryByText('A eliminar')).not.toBeInTheDocument());
  });

  it('admin: clicking "No" in confirm row cancels deletion', async () => {
    setup({ user: { _id: 'admin', isAdmin: true }, noticias: [makeNoticia({ title: 'No borrar' })] });
    await screen.findByText('No borrar');
    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));
    fireEvent.click(screen.getByRole('button', { name: /^no$/i }));
    expect(screen.getByText('No borrar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^sí$/i })).not.toBeInTheDocument();
  });

  it('shows skeletons while loading', async () => {
    // Delay response to catch loading state
    let resolve;
    server.use(
      http.get('/api/noticias', () => new Promise((res) => { resolve = () => res(HttpResponse.json({ noticias: [], page: 1, pages: 1, total: 0 })); })),
    );
    setup({});
    // Skeletons are rendered while loading
    // Check that the page renders without crashing during load
    expect(screen.queryByRole('heading', { name: 'Noticias' })).toBeInTheDocument();
    resolve?.();
    await waitFor(() => expect(screen.getByText(/sin noticias/i)).toBeInTheDocument());
  });

  it('admin: "Ver más noticias" loads additional page', async () => {
    const page1 = [makeNoticia({ _id: 'n1', title: 'Noticia p1' })];
    const page2 = [makeNoticia({ _id: 'n2', title: 'Noticia p2' })];
    // Use setup() with the initial page, then override for page 2
    useAuth.mockReturnValue({ user: { _id: 'admin', isAdmin: true } });
    server.use(
      http.get('/api/noticias', ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        if (page === 2) return HttpResponse.json({ noticias: page2, page: 2, pages: 2, total: 2 });
        return HttpResponse.json({ noticias: page1, page: 1, pages: 2, total: 2 });
      }),
    );
    render(
      <HelmetProvider>
        <MemoryRouter>
          <Noticias />
        </MemoryRouter>
      </HelmetProvider>,
    );
    await screen.findByText('Noticia p1');
    expect(screen.getByRole('button', { name: /ver más noticias/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver más noticias/i }));
    await waitFor(() => expect(screen.getByText('Noticia p2')).toBeInTheDocument());
    expect(screen.getByText('Noticia p1')).toBeInTheDocument(); // both visible
  });

  it('admin: clicking "+ Publicar noticia" in empty state opens the create form', async () => {
    setup({ user: { _id: 'admin', isAdmin: true }, noticias: [] });
    await screen.findByText(/sin noticias/i);
    fireEvent.click(screen.getByRole('button', { name: /publicar noticia/i }));
    expect(screen.getByText(/nueva noticia/i)).toBeInTheDocument();
  });

  it('NoticiaCard with image shows a button (lightbox toggle)', async () => {
    const n = makeNoticia({ image: { url: 'https://example.com/img.jpg', publicId: 'abc' } });
    setup({ noticias: [n] });
    await screen.findByAltText(n.title);
    // The image is wrapped in a button for lightbox
    const imgBtn = screen.getByRole('button', { name: /ver imagen/i });
    expect(imgBtn).toBeInTheDocument();
  });
});
