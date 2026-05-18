import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuestNavbar from './GuestNavbar';

describe('<GuestNavbar>', () => {
  function renderNav() {
    return render(
      <MemoryRouter>
        <GuestNavbar />
      </MemoryRouter>,
    );
  }

  it('renders the TurnoCero brand mark', () => {
    renderNav();
    expect(screen.getByText('TurnoCero')).toBeInTheDocument();
    expect(screen.getByText('T')).toBeInTheDocument();
    expect(screen.getByText('BOARD GAME MEETUPS')).toBeInTheDocument();
  });

  it('logo links to "/"', () => {
    renderNav();
    const logoLink = screen.getByText('TurnoCero').closest('a');
    expect(logoLink).toHaveAttribute('href', '/');
  });

  it('renders Login and Registrate CTAs with correct hrefs', () => {
    renderNav();
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Registrate' })).toHaveAttribute('href', '/register');
  });
});
