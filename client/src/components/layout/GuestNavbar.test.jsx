import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GuestNavbar from './GuestNavbar';
import { AllProviders } from '../../test/wrappers/AllProviders';

describe('<GuestNavbar>', () => {
  function renderNav() {
    return render(<GuestNavbar />, { wrapper: AllProviders });
  }

  it('renders the TurnoCero brand mark', () => {
    renderNav();
    expect(screen.getByText('TurnoCero')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'TurnoCero' })).toHaveAttribute('src', '/logo.svg');
    expect(screen.getByText('BOARD GAME MEETUPS')).toBeInTheDocument();
  });

  it('logo links to "/"', () => {
    renderNav();
    const logoLink = screen.getByText('TurnoCero').closest('a');
    expect(logoLink).toHaveAttribute('href', '/');
  });

  it('renders Login and Registrate CTAs with correct hrefs', () => {
    renderNav();
    expect(screen.getByRole('link', { name: 'Iniciá sesión' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Registrate' })).toHaveAttribute('href', '/register');
  });
});
