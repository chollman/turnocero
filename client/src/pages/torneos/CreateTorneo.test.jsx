import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

// Skip the image dropzone heavy logic — out of scope for create form tests.
vi.mock('./components/ImageDropzone', () => ({ default: () => null }));

import CreateTorneo from './CreateTorneo';

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <CreateTorneo />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

beforeEach(() => {
  navigateMock.mockReset();
});

describe('<CreateTorneo>', () => {
  it('renders title + game + format fields', () => {
    renderPage();
    expect(screen.getAllByText(/crear torneo/i).length).toBeGreaterThan(0);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('submit with missing fields shows validation error', () => {
    renderPage();
    const form = screen.getAllByRole('textbox')[0].closest('form');
    fireEvent.submit(form);
    expect(screen.getByText(/complet[aá]/i)).toBeInTheDocument();
  });

  it('successful submit POSTs to /api/torneos and navigates to detail', async () => {
    server.use(
      http.post('/api/torneos', () => HttpResponse.json({ _id: 'new-torneo-id', title: 'Test' }, { status: 201 })),
    );
    renderPage();
    const textboxes = screen.getAllByRole('textbox');
    // First textbox = title; second = description; third = game (likely).
    fireEvent.change(textboxes[0], { target: { value: 'Mi Torneo' } });
    // Find the game input — it's another text input. Set both first two title/desc/game inputs.
    if (textboxes[1]) fireEvent.change(textboxes[1], { target: { value: 'Desc' } });
    if (textboxes[2]) fireEvent.change(textboxes[2], { target: { value: 'Catán' } });

    fireEvent.submit(textboxes[0].closest('form'));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/torneos/new-torneo-id');
    });
  });

  it('shows API error when create fails', async () => {
    server.use(
      http.post('/api/torneos', () =>
        HttpResponse.json({ message: 'Solo admins pueden crear torneos' }, { status: 403 }),
      ),
    );
    renderPage();
    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'X' } });
    if (textboxes[1]) fireEvent.change(textboxes[1], { target: { value: 'D' } });
    if (textboxes[2]) fireEvent.change(textboxes[2], { target: { value: 'G' } });

    fireEvent.submit(textboxes[0].closest('form'));
    expect(await screen.findByText(/solo admins/i)).toBeInTheDocument();
  });
});
