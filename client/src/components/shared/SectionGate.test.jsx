import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SectionGate from './SectionGate';

// Mock the SiteConfigContext hook so we can drive its return per test.
vi.mock('../../context/SiteConfigContext', () => ({
  useSiteConfig: vi.fn(),
}));

import { useSiteConfig } from '../../context/SiteConfigContext';

function renderWithRouter(ui, { initialEntries = ['/'] } = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={ui} />
        <Route path="/elsewhere" element={<div>elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('<SectionGate>', () => {
  it('renders null while site config is not loaded yet', () => {
    useSiteConfig.mockReturnValue({ loaded: false, isSectionEnabled: () => true });
    const { container } = renderWithRouter(
      <SectionGate section="mesas"><div>kids</div></SectionGate>,
    );
    expect(container.textContent).toBe('');
  });

  it('renders children when the section is enabled', () => {
    useSiteConfig.mockReturnValue({ loaded: true, isSectionEnabled: (s) => s === 'compartidas' });
    renderWithRouter(
      <SectionGate section="compartidas"><div>visible</div></SectionGate>,
    );
    expect(screen.getByText('visible')).toBeInTheDocument();
  });

  it('redirects to "/" when the section is disabled', () => {
    useSiteConfig.mockReturnValue({ loaded: true, isSectionEnabled: () => false });
    render(
      <MemoryRouter initialEntries={['/mesas']}>
        <Routes>
          <Route path="/mesas" element={<SectionGate section="mesas"><div>hidden</div></SectionGate>} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText('hidden')).not.toBeInTheDocument();
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('honors custom redirectTo', () => {
    useSiteConfig.mockReturnValue({ loaded: true, isSectionEnabled: () => false });
    render(
      <MemoryRouter initialEntries={['/mesas']}>
        <Routes>
          <Route
            path="/mesas"
            element={<SectionGate section="mesas" redirectTo="/elsewhere"><div>hidden</div></SectionGate>}
          />
          <Route path="/elsewhere" element={<div>landed</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('landed')).toBeInTheDocument();
  });
});
