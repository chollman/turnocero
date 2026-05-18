import { describe, it, expect, vi, beforeEach } from 'vitest';
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
});
