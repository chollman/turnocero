import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GuestBanner, GuestInlineCTA, GuestFooter } from './BgWatchGuestCTAs';

function renderInRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('BG Watch guest CTAs', () => {
  it('GuestBanner renders bggUsername and a register link with source=bg-watch', () => {
    renderInRouter(<GuestBanner bggUsername="CarcaFan" />);
    expect(screen.getByText(/@CarcaFan/)).toBeInTheDocument();
    expect(screen.getByText(/Llevá tus partidas/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /registrate gratis/i });
    expect(link).toHaveAttribute('href', '/register?source=bg-watch');
  });

  it('GuestInlineCTA renders the soft-sell copy', () => {
    renderInRouter(<GuestInlineCTA />);
    expect(screen.getByText(/¿Tenés cuenta en BoardGameGeek\?/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /empezar/i })).toHaveAttribute('href', '/register?source=bg-watch');
  });

  it('GuestFooter renders the bggUsername and final CTA', () => {
    renderInRouter(<GuestFooter bggUsername="CarcaFan" />);
    expect(screen.getByText(/@CarcaFan/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /registrate gratis/i })).toHaveAttribute('href', '/register?source=bg-watch');
  });
});
