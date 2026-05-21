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

  it('does NOT count permanently-rejected users in the slot count (regression)', () => {
    // total=10 includes 4 perm-rejected; display should show 6, not 10
    renderCard({ event: { maxParticipants: 32, registrationCount: { total: 10, pending: 2, confirmed: 4 } } });
    expect(screen.getByText('6/32')).toBeInTheDocument();
    expect(screen.queryByText('10/32')).not.toBeInTheDocument();
  });

  it('uses active count when no maxParticipants (excludes rejected)', () => {
    const { container } = renderCard({
      event: {
        maxParticipants: null,
        registrationCount: { total: 8, pending: 1, confirmed: 4 },
      },
    });
    // active = 5 (pending + confirmed). The meta block has the cupo text;
    // it should contain "5" and never "8".
    const meta = container.querySelector('[class*="meta"]');
    expect(meta.textContent).toContain('5');
    expect(meta.textContent).not.toContain('8');
  });

  it('renders location.texto when location is a subdocument', () => {
    renderCard({
      event: { location: { texto: 'Av. Corrientes 1234', lat: -34.6, lng: -58.4 } },
    });
    expect(screen.getByText('Av. Corrientes 1234')).toBeInTheDocument();
  });

  it('shows distance badge when distanceKm is provided', () => {
    renderCard({
      event: {
        location: { texto: 'CABA', lat: -34.6, lng: -58.4 },
        distanceKm: 12.34,
      },
    });
    expect(screen.getByText(/12,3 km/)).toBeInTheDocument();
  });

  it('does NOT show distance when distanceKm is null', () => {
    renderCard({
      event: { location: { texto: 'CABA' }, distanceKm: null },
    });
    expect(screen.queryByText(/km/)).not.toBeInTheDocument();
  });

  it('shows only the city (not the full address) when location is a Google formatted_address', () => {
    renderCard({
      event: {
        location: {
          texto: 'Av. de Mayo 1123, B1650 San Martín, Provincia de Buenos Aires, Argentina',
          lat: -34.5,
          lng: -58.5,
        },
      },
    });
    // Solo la localidad debe estar visible.
    expect(screen.getByText('San Martín')).toBeInTheDocument();
    // La dirección completa NO debe aparecer (queda solo en el title tooltip).
    expect(screen.queryByText(/Av\. de Mayo 1123/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Provincia de Buenos Aires/)).not.toBeInTheDocument();
  });
});
