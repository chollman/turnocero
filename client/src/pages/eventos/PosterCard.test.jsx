import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PosterCard from './PosterCard';

function makeEvento(overrides = {}) {
  return {
    _id: 'e1',
    title: 'Open Magic Commander',
    eventDate: '2026-07-05T13:00:00',
    location: 'Mago Local Games',
    fee: 5000,
    maxParticipants: 32,
    registrationCount: { total: 6, pending: 0, confirmed: 6 },
    status: 'open',
    image: null,
    ...overrides,
  };
}

function renderCard(props = {}) {
  return render(
    <MemoryRouter>
      <PosterCard evento={props.evento ?? makeEvento(props.event)} {...props} />
    </MemoryRouter>
  );
}

describe('<PosterCard>', () => {
  it('renders title, location, capacity, fee', () => {
    renderCard();
    expect(screen.getByText('Open Magic Commander')).toBeInTheDocument();
    expect(screen.getByText('Mago Local Games')).toBeInTheDocument();
    expect(screen.getByText('6/32')).toBeInTheDocument();
    expect(screen.getByText(/\$5\.000/)).toBeInTheDocument();
  });

  it('shows "Gratis" for fee 0', () => {
    renderCard({ event: { fee: 0 } });
    expect(screen.getByText('Gratis')).toBeInTheDocument();
  });

  it('renders fallback when no image', () => {
    const { container } = renderCard();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(/imagen del evento/i)).toBeInTheDocument();
  });

  it('renders image when provided', () => {
    renderCard({
      event: { image: { url: 'https://cdn.example.com/x.jpg', publicId: 'x' } },
    });
    const img = screen.getByAltText('Open Magic Commander');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/x.jpg');
  });

  it('renders draft watermark when status is draft', () => {
    renderCard({ event: { status: 'draft' } });
    const watermarks = screen.getAllByText(/borrador/i);
    expect(watermarks.length).toBeGreaterThan(0);
  });

  it('renders correct status badge for cancelled', () => {
    renderCard({ event: { status: 'cancelled' } });
    // Status badge + CTA both say "Cancelado".
    expect(screen.getAllByText('Cancelado').length).toBeGreaterThan(0);
  });

  it('shows "Administrar" CTA when isHost is true', () => {
    renderCard({ isHost: true });
    expect(screen.getByText(/administrar/i)).toBeInTheDocument();
  });

  it('shows "Inscripto" CTA when user is confirmed', () => {
    renderCard({ userRegistrationStatus: 'confirmed' });
    expect(screen.getByText(/inscripto/i)).toBeInTheDocument();
  });

  it('links to the detail page', () => {
    const { container } = renderCard();
    const link = container.querySelector('a');
    expect(link.getAttribute('href')).toBe('/eventos/e1');
  });
});
