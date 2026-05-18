import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuestBottomNav from './GuestBottomNav';

vi.mock('../../context/SiteConfigContext', () => ({
  useSiteConfig: vi.fn(),
}));
import { useSiteConfig } from '../../context/SiteConfigContext';

function renderAt(pathname, sectionEnabledMap = {}) {
  useSiteConfig.mockReturnValue({
    isSectionEnabled: (k) => sectionEnabledMap[k] ?? true,
  });
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <GuestBottomNav />
    </MemoryRouter>,
  );
}

describe('<GuestBottomNav>', () => {
  it('renders all three guest-visible sections when enabled', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: /noticias/i })).toHaveAttribute('href', '/noticias');
    expect(screen.getByRole('link', { name: /compartidas/i })).toHaveAttribute('href', '/compartidas');
    expect(screen.getByRole('link', { name: /utilidades/i })).toHaveAttribute('href', '/utilidades');
  });

  it('hides any disabled section from the nav', () => {
    renderAt('/', { utilidades: false });
    expect(screen.queryByRole('link', { name: /utilidades/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('marks the current section as active and adds the active dot', () => {
    const { container } = renderAt('/compartidas');
    const compartidas = screen.getByRole('link', { name: /compartidas/i });
    expect(compartidas.className).toMatch(/active/i);
    // Only the active link should have the dot.
    expect(container.querySelectorAll('.activeDot, [class*="activeDot"]')).toHaveLength(1);
  });

  it('no item is active when on a guest-irrelevant route', () => {
    renderAt('/some-unrelated-path');
    const links = screen.getAllByRole('link');
    links.forEach((l) => expect(l.className).not.toMatch(/itemActive/i));
  });
});
