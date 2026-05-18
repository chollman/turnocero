import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
import PageTransition from './PageTransition';

function renderApp(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Link to="/mesas">Mesas</Link>
      <Link to="/compartidas">Compartidas</Link>
      <Link to="/mesas/123">Detail</Link>
      <PageTransition>
        <Route path="/" element={<div data-testid="home">Home</div>} />
        <Route path="/mesas" element={<div data-testid="mesas">Mesas Page</div>} />
        <Route path="/mesas/:id" element={<div data-testid="mesa-detail">Mesa Detail</div>} />
        <Route path="/compartidas" element={<div data-testid="compartidas">Compartidas Page</div>} />
      </PageTransition>
    </MemoryRouter>,
  );
}

describe('<PageTransition>', () => {
  it('renders the matched route on initial render', () => {
    renderApp('/');
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('swaps instantly when navigating within the same section', () => {
    renderApp('/mesas');
    expect(screen.getByTestId('mesas')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Detail'));
    // No animation needed; the detail is rendered directly.
    expect(screen.getByTestId('mesa-detail')).toBeInTheDocument();
  });

  it('applies a slide animation class when switching sections', () => {
    const { container } = renderApp('/mesas');
    expect(screen.getByTestId('mesas')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Compartidas'));
    // Wrapper now has a slide class until the animation completes
    const wrapper = container.querySelector('div[class*="slide"]');
    expect(wrapper).toBeTruthy();
  });
});
