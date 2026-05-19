import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BottomNav from './BottomNav';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../context/SiteConfigContext', () => ({ useSiteConfig: vi.fn() }));

import { useAuth } from '../../context/AuthContext';
import { useSiteConfig } from '../../context/SiteConfigContext';

function setup({
  user = { _id: 'u1', username: 'cha' },
  isActuallyAdmin = false,
  sections = {},
  pathname = '/',
} = {}) {
  useAuth.mockReturnValue({ user, isActuallyAdmin });
  useSiteConfig.mockReturnValue({
    isSectionEnabled: (k) => sections[k] ?? true,
  });
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <BottomNav />
    </MemoryRouter>,
  );
}

describe('<BottomNav>', () => {
  it('shows Compartite + Noticias + Eventos by default for regular users', () => {
    setup();
    expect(screen.getByRole('link', { name: /compartite/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /noticias/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /eventos/i })).toBeInTheDocument();
  });

  it('hides items whose section is disabled', () => {
    setup({ sections: { noticias: false } });
    expect(screen.queryByRole('link', { name: /^noticias/i })).not.toBeInTheDocument();
  });

  it('shows admin-only items (Panel, DB) only to actual admins', () => {
    setup({ isActuallyAdmin: false });
    expect(screen.queryByRole('link', { name: /panel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^DB$/ })).not.toBeInTheDocument();
  });

  it('admins see admin-only items (Panel/DB) — even though the carousel only renders 3 at a time, an admin-only item is in the items list', () => {
    // Disable most sections so the visible window contains admin items.
    setup({
      isActuallyAdmin: true,
      sections: {
        compartidas: false, noticias: false, eventos: false, comunidad: false,
        utilidades: false, bgwatch: false, mesas: false, torneos: false, miFeed: false,
      },
    });
    // Only adminOnly items remain (Panel, DB); both should fit in the visible window.
    expect(screen.getByRole('link', { name: /panel/i })).toBeInTheDocument();
  });

  it('shows "Activá" CTA for users without bggUsername (when bgwatch is one of the visible items)', () => {
    setup({
      user: { _id: 'u1', username: 'cha' },
      sections: {
        compartidas: false, noticias: false, eventos: false, comunidad: false, utilidades: false,
        bgwatch: true,
      },
    });
    expect(screen.getByRole('link', { name: /activ[aá]/i })).toBeInTheDocument();
  });

  it('shows BG Watch link when user has bggUsername (visible item)', () => {
    setup({
      user: { _id: 'u1', username: 'cha', bggUsername: 'CarcassonneFan' },
      sections: {
        compartidas: false, noticias: false, eventos: false, comunidad: false, utilidades: false,
        bgwatch: true,
      },
    });
    const link = screen.getByRole('link', { name: /bg watch/i });
    expect(link).toHaveAttribute('href', '/bg-watch/CarcassonneFan');
  });

  it('marks the current path as active', () => {
    setup({ pathname: '/eventos' });
    const eventos = screen.getByRole('link', { name: /eventos/i });
    expect(eventos.className).toMatch(/active/i);
  });

  it('renders pager dots when items exceed the visible window', () => {
    const { container } = setup({
      isActuallyAdmin: true,
      // All sections on → lots of items → pager active
      sections: {
        compartidas: true, noticias: true, eventos: true, comunidad: true,
        utilidades: true, bgwatch: true, mesas: true, torneos: true, miFeed: true,
      },
    });
    const pager = container.querySelector('[class*="pager"]');
    expect(pager).not.toBeNull();
    // At least two dots — there's more than VISIBLE=3 items
    expect(pager.children.length).toBeGreaterThanOrEqual(2);
  });
});
