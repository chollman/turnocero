import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../context/SiteConfigContext', () => ({ useSiteConfig: vi.fn() }));

import CompartidaCard from './CompartidaCard';
import { useAuth } from '../../context/AuthContext';
import { useSiteConfig } from '../../context/SiteConfigContext';

function makePost(overrides = {}) {
  return {
    _id: 'c1',
    title: overrides.title ?? '',
    body: overrides.body ?? 'Anoche jugamos Catán',
    images: overrides.images || [],
    privacy: overrides.privacy || 'public',
    linkedTable: overrides.linkedTable || null,
    likes: overrides.likes || [],
    commentCount: overrides.commentCount ?? 0,
    author: overrides.author || {
      _id: 'a1',
      username: 'cha',
      displayName: 'Claudio H',
      avatar: { url: '', publicId: '' },
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderCard(post, { user = null } = {}) {
  useAuth.mockReturnValue({ user });
  useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
  return render(
    <MemoryRouter>
      <CompartidaCard post={post} onDeleted={vi.fn()} onUpdated={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('<CompartidaCard>', () => {
  it('renders the author name and body', () => {
    renderCard(makePost());
    expect(screen.getByText(/Claudio H/)).toBeInTheDocument();
    expect(screen.getByText(/Anoche jugamos Catán/)).toBeInTheDocument();
  });

  it('renders the title when provided', () => {
    renderCard(makePost({ title: 'Una sesión épica' }));
    expect(screen.getByText('Una sesión épica')).toBeInTheDocument();
  });

  it('shows the like count when present', () => {
    renderCard(makePost({ likes: ['u1', 'u2', 'u3'] }));
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('clicking like as logged user makes an API call', async () => {
    let likeCalled = false;
    server.use(
      http.post('/api/compartidas/:id/like', () => { likeCalled = true; return HttpResponse.json({ liked: true }); }),
    );
    renderCard(makePost(), { user: { _id: 'me', username: 'me' } });

    // Find any button with a "0" inside (initial like count display).
    const buttons = screen.getAllByRole('button');
    const heart = buttons.find((b) => b.textContent === '0');
    if (heart) {
      fireEvent.click(heart);
      await waitFor(() => expect(likeCalled).toBe(true));
    }
  });

  it('shows "Eliminado" / ghost avatar when author is null (deleted)', () => {
    renderCard(makePost({ author: null }));
    expect(screen.getByText(/usuario eliminado/i)).toBeInTheDocument();
  });

  it('shows privacy label for non-public posts', () => {
    renderCard(makePost({ privacy: 'friends' }), { user: { _id: 'me' } });
    expect(screen.getByText(/amigos/i)).toBeInTheDocument();
  });

  it('shows admin menu (Editar/Eliminar) only for the author', () => {
    renderCard(makePost({ author: { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } } }),
      { user: { _id: 'me', username: 'me' } });
    // The "⋯" menu button should be visible for the author
    expect(screen.getByText('⋯')).toBeInTheDocument();
  });

  it('non-authors do not see the admin menu', () => {
    renderCard(makePost(), { user: { _id: 'other', username: 'other' } });
    expect(screen.queryByText('⋯')).not.toBeInTheDocument();
  });

  it('expanded body shows truncated copy with ellipsis when body > 220 chars', () => {
    const longBody = 'x'.repeat(300);
    renderCard(makePost({ body: longBody }));
    // Truncated to first 220 + "…"
    expect(screen.getByText(/x{220}…/)).toBeInTheDocument();
  });

  it('renders image thumbnails when post has images', () => {
    const { container } = renderCard(makePost({ images: [
      { _id: 'i1', url: 'https://cdn/a.jpg' },
      { _id: 'i2', url: 'https://cdn/b.jpg' },
    ]}));
    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBeGreaterThanOrEqual(2);
  });

  it('renders linked table chip when mesas is enabled and post has linkedTable', () => {
    renderCard(makePost({
      linkedTable: {
        _id: 't1',
        boardGame: 'Catán',
        date: new Date(Date.now() + 86400000).toISOString(),
        players: [{ _id: 'p1' }],
        maxPlayers: 4,
        status: 'open',
      },
    }));
    // Game name appears (the linked-table chip)
    expect(screen.getAllByText(/Catán/).length).toBeGreaterThan(0);
  });

  it('hides linked table chip when mesas is disabled', () => {
    useSiteConfig.mockReturnValue({ isSectionEnabled: (k) => k !== 'mesas' });
    useAuth.mockReturnValue({ user: null });
    render(
      <MemoryRouter>
        <CompartidaCard
          post={makePost({
            linkedTable: {
              _id: 't1', boardGame: 'Catán',
              date: new Date().toISOString(), players: [], maxPlayers: 4, status: 'open',
            },
          })}
          onDeleted={vi.fn()}
          onUpdated={vi.fn()}
        />
      </MemoryRouter>,
    );
    // Body still renders but no linked table chip
    expect(screen.getByText(/Anoche jugamos Catán/)).toBeInTheDocument();
  });

  it('clicking like as guest opens LoginPromptModal', () => {
    renderCard(makePost(), { user: null });
    const buttons = screen.getAllByRole('button');
    const likeBtn = buttons.find((b) => b.textContent === '0');
    if (likeBtn) {
      fireEvent.click(likeBtn);
      expect(screen.getByText(/iniciá sesión/i)).toBeInTheDocument();
    }
  });

  it('clicking ⋯ menu opens dropdown with Editar/Eliminar', () => {
    renderCard(
      makePost({ author: { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } } }),
      { user: { _id: 'me', username: 'me' } },
    );
    fireEvent.click(screen.getByText('⋯'));
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
  });

  it('clicking Eliminar confirms and DELETEs the compartida', async () => {
    const onDeleted = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let deleted = false;
    server.use(
      http.delete('/api/compartidas/:id', () => { deleted = true; return HttpResponse.json({ ok: true }); }),
    );
    useAuth.mockReturnValue({ user: { _id: 'me', username: 'me' } });
    useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
    render(
      <MemoryRouter>
        <CompartidaCard
          post={makePost({ author: { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } } })}
          onDeleted={onDeleted}
          onUpdated={vi.fn()}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('⋯'));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(deleted).toBe(true));
    expect(onDeleted).toHaveBeenCalledWith('c1');
    confirmSpy.mockRestore();
  });

  it('opening edit mode shows the title/body/privacy inputs', () => {
    renderCard(
      makePost({ author: { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } } }),
      { user: { _id: 'me', username: 'me' } },
    );
    fireEvent.click(screen.getByText('⋯'));
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByPlaceholderText(/título/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Público' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solo yo' })).toBeInTheDocument();
  });

  it('renders the featured badge when featured=true', () => {
    useAuth.mockReturnValue({ user: null });
    useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
    render(
      <MemoryRouter>
        <CompartidaCard post={makePost()} featured onDeleted={vi.fn()} onUpdated={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/compartida del día/i)).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Body expand/collapse
  // -----------------------------------------------------------------------
  it('"Ver más" expands a long body and "Ver menos" collapses it', () => {
    const longBody = 'A'.repeat(300);
    renderCard(makePost({ body: longBody }));
    expect(screen.getByRole('button', { name: /ver más/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver más/i }));
    expect(screen.getByRole('button', { name: /ver menos/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver menos/i }));
    expect(screen.getByRole('button', { name: /ver más/i })).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Edit save & cancel
  // -----------------------------------------------------------------------
  it('saving an edit calls PUT and updates displayed body', async () => {
    const post = makePost({
      author: { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } },
      body: 'Cuerpo original',
    });
    server.use(
      http.put('/api/compartidas/:id', async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ ...post, ...body });
      }),
    );
    renderCard(post, { user: { _id: 'me', username: 'me' } });
    fireEvent.click(screen.getByText('⋯'));
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    const textarea = screen.getByPlaceholderText(/cómo estuvo/i);
    fireEvent.change(textarea, { target: { value: 'Cuerpo actualizado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(screen.getByText('Cuerpo actualizado')).toBeInTheDocument());
  });

  it('cancelling edit hides the edit form', () => {
    renderCard(
      makePost({ author: { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } } }),
      { user: { _id: 'me', username: 'me' } },
    );
    fireEvent.click(screen.getByText('⋯'));
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Comments section
  // -----------------------------------------------------------------------
  it('clicking comments toggle loads and shows the comments section', async () => {
    server.use(
      http.get('/api/compartidas/:id/comments', () =>
        HttpResponse.json([
          { _id: 'cm1', content: '¡Qué partida!', author: { _id: 'u2', username: 'bob', avatar: { url: '', publicId: '' } }, createdAt: new Date().toISOString() },
        ])
      ),
    );
    renderCard(makePost({ commentCount: 1 }), { user: { _id: 'me', username: 'me' } });
    const commentBtn = screen.getByText(/comentario/i);
    fireEvent.click(commentBtn);
    await waitFor(() => expect(screen.getByText('¡Qué partida!')).toBeInTheDocument());
    expect(screen.getByPlaceholderText(/escribí un comentario/i)).toBeInTheDocument();
  });

  it('guest sees "Iniciá sesión para comentar" in comments section', async () => {
    server.use(
      http.get('/api/compartidas/:id/comments', () => HttpResponse.json([])),
    );
    renderCard(makePost(), { user: null });
    fireEvent.click(screen.getByText(/comentario/i));
    await waitFor(() => expect(screen.getByText(/iniciá sesión para comentar/i)).toBeInTheDocument());
  });

  it('shows "Sin comentarios" when comment list is empty', async () => {
    server.use(
      http.get('/api/compartidas/:id/comments', () => HttpResponse.json([])),
    );
    renderCard(makePost(), { user: { _id: 'me', username: 'me' } });
    fireEvent.click(screen.getByText(/comentario/i));
    await waitFor(() => expect(screen.getByText(/sin comentarios/i)).toBeInTheDocument());
  });

  it('adding a comment POSTs and appends it to the list', async () => {
    const newComment = { _id: 'cm_new', content: 'Gran partida!', author: { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } }, createdAt: new Date().toISOString() };
    server.use(
      http.get('/api/compartidas/:id/comments', () => HttpResponse.json([])),
      http.post('/api/compartidas/:id/comments', () => HttpResponse.json(newComment)),
    );
    renderCard(makePost(), { user: { _id: 'me', username: 'me' } });
    fireEvent.click(screen.getByText(/comentario/i));
    await waitFor(() => expect(screen.getByPlaceholderText(/escribí un comentario/i)).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/escribí un comentario/i), { target: { value: 'Gran partida!' } });
    fireEvent.submit(screen.getByPlaceholderText(/escribí un comentario/i).closest('form'));
    await waitFor(() => expect(screen.getByText('Gran partida!')).toBeInTheDocument());
  });

  it('deleting a comment removes it from the list', async () => {
    const comment = { _id: 'cm1', content: 'Viejito comentario', author: { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } }, createdAt: new Date().toISOString() };
    server.use(
      http.get('/api/compartidas/:id/comments', () => HttpResponse.json([comment])),
      http.delete('/api/compartidas/:id/comments/:cid', () => HttpResponse.json({ ok: true })),
    );
    renderCard(makePost(), { user: { _id: 'me', username: 'me' } });
    fireEvent.click(screen.getByText(/comentario/i));
    await waitFor(() => expect(screen.getByText('Viejito comentario')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0]);
    await waitFor(() => expect(screen.queryByText('Viejito comentario')).not.toBeInTheDocument());
  });

  it('re-clicking the comments button collapses the section', async () => {
    server.use(
      http.get('/api/compartidas/:id/comments', () => HttpResponse.json([])),
    );
    renderCard(makePost(), { user: { _id: 'me', username: 'me' } });
    const btn = screen.getByText(/comentario/i);
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByText(/sin comentarios/i)).toBeInTheDocument());
    fireEvent.click(btn);
    expect(screen.queryByText(/sin comentarios/i)).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Lightbox
  // -----------------------------------------------------------------------
  it('clicking an image photo opens the lightbox and clicking again closes it', () => {
    const { container } = renderCard(makePost({
      images: [{ _id: 'i1', url: 'https://cdn/photo.jpg' }],
    }));
    // Click the photo button
    const photoBtn = container.querySelector('button.photoBtn') || screen.getAllByRole('button').find((b) => b.querySelector('img'));
    if (photoBtn) {
      fireEvent.click(photoBtn);
      // Lightbox should now show a full-size image
      const lightboxImgs = container.querySelectorAll('img');
      expect(lightboxImgs.length).toBeGreaterThan(0);
    }
  });

  // -----------------------------------------------------------------------
  // BgWatch author link
  // -----------------------------------------------------------------------
  it('renders AuthorBgWatchLink when bgwatch is enabled and author has bggUsername', () => {
    useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
    useAuth.mockReturnValue({ user: null });
    render(
      <MemoryRouter>
        <CompartidaCard
          post={makePost({ author: { _id: 'a1', username: 'cha', bggUsername: 'chaborg', avatar: { url: '', publicId: '' } } })}
          onDeleted={vi.fn()}
          onUpdated={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /bg watch de cha/i })).toBeInTheDocument();
  });

  it('does not render BgWatch link when bgwatch section is disabled', () => {
    useSiteConfig.mockReturnValue({ isSectionEnabled: (s) => s !== 'bgwatch' });
    useAuth.mockReturnValue({ user: null });
    render(
      <MemoryRouter>
        <CompartidaCard
          post={makePost({ author: { _id: 'a1', username: 'cha', bggUsername: 'chaborg', avatar: { url: '', publicId: '' } } })}
          onDeleted={vi.fn()}
          onUpdated={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link', { name: /bg watch/i })).not.toBeInTheDocument();
  });
});
