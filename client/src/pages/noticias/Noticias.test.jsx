import { describe, it, expect, vi, beforeEach } from 'vitest';
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
});
