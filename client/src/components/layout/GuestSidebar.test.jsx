import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuestSidebar from './GuestSidebar';

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
      <GuestSidebar />
    </MemoryRouter>,
  );
}

describe('<GuestSidebar>', () => {
  it('renders the brand logo + login/register CTAs', () => {
    renderAt('/');
    expect(screen.getByText('TurnoCero')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sesi[oó]n/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /registrate/i })).toHaveAttribute('href', '/register');
  });

  it('shows Noticias + Compartidas when both sections are enabled', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: /noticias/i })).toHaveAttribute('href', '/noticias');
    expect(screen.getByRole('link', { name: /compartidas/i })).toHaveAttribute('href', '/compartidas');
  });

  it('hides Noticias when the section is disabled', () => {
    renderAt('/', { noticias: false });
    expect(screen.queryByRole('link', { name: /noticias/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /compartidas/i })).toBeInTheDocument();
  });

  it('marks the current path as active', () => {
    renderAt('/noticias');
    const noticiasLink = screen.getByRole('link', { name: /noticias/i });
    expect(noticiasLink.className).toMatch(/active/i);
    const compartidasLink = screen.getByRole('link', { name: /compartidas/i });
    expect(compartidasLink.className).not.toMatch(/active/i);
  });
});
