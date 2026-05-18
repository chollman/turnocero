import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EventoCard from './EventoCard';

function makeEvento(overrides = {}) {
  return {
    _id: 'e1',
    title: 'Torneo de Catán',
    description: 'Un evento increíble',
    status: 'open',
    fee: 1500,
    image: { url: 'https://cdn/evento.jpg' },
    eventDate: '2026-06-15T18:00:00Z',
    location: 'Buenos Aires',
    ...overrides,
  };
}

function renderCard(props = {}) {
  return render(
    <MemoryRouter>
      <EventoCard evento={props.evento ?? makeEvento(props.event)} userRegistration={props.userRegistration} />
    </MemoryRouter>,
  );
}

describe('<EventoCard>', () => {
  it('renders the title and links to /eventos/:id', () => {
    renderCard();
    expect(screen.getByText('Torneo de Catán')).toBeInTheDocument();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/eventos/e1');
  });

  it('renders the image when image.url is present', () => {
    renderCard();
    const img = screen.getByAltText('Torneo de Catán');
    expect(img).toHaveAttribute('src', 'https://cdn/evento.jpg');
  });

  it('omits the image when image.url is absent', () => {
    renderCard({ evento: makeEvento({ image: null }) });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders the status badge label', () => {
    renderCard();
    expect(screen.getByText('Abierto')).toBeInTheDocument();
  });

  it('renders "Gratis" badge when fee is 0', () => {
    renderCard({ evento: makeEvento({ fee: 0 }) });
    expect(screen.getByText('Gratis')).toBeInTheDocument();
  });

  it('formats fee as $N with es-AR thousands separator', () => {
    renderCard({ evento: makeEvento({ fee: 12500 }) });
    expect(screen.getByText('$12.500')).toBeInTheDocument();
  });

  it('renders the user-registration badge when provided', () => {
    renderCard({ userRegistration: { status: 'pending' } });
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });

  it('renders confirmed registration badge', () => {
    renderCard({ userRegistration: { status: 'confirmed' } });
    expect(screen.getByText('Confirmado')).toBeInTheDocument();
  });

  it('renders rejected registration badge', () => {
    renderCard({ userRegistration: { status: 'rejected' } });
    expect(screen.getByText('Rechazado')).toBeInTheDocument();
  });

  it('renders date and location metadata', () => {
    renderCard();
    expect(screen.getByText(/buenos aires/i)).toBeInTheDocument();
    expect(screen.getByText('📅')).toBeInTheDocument();
    expect(screen.getByText('📍')).toBeInTheDocument();
  });

  it('renders description when present', () => {
    renderCard();
    expect(screen.getByText('Un evento increíble')).toBeInTheDocument();
  });

  it('renders different status labels: Cerrado, Cancelado, Borrador', () => {
    const { rerender } = renderCard({ evento: makeEvento({ status: 'closed' }) });
    expect(screen.getByText('Cerrado')).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <EventoCard evento={makeEvento({ status: 'cancelled' })} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Cancelado')).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <EventoCard evento={makeEvento({ status: 'draft' })} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Borrador')).toBeInTheDocument();
  });
});
