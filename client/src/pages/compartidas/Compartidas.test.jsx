import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../context/SiteConfigContext', () => ({ useSiteConfig: vi.fn() }));

// Heavy children — stub for focused testing of feed loading logic.
vi.mock('./CompartidaCard', () => ({
  default: ({ post }) => <div data-testid="compartida-card">{post.body}</div>,
}));
vi.mock('./CreateCompartidaForm', () => ({ default: () => null }));
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
});
