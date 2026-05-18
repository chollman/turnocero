import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

import CreateCompartidaForm from './CreateCompartidaForm';
import { useAuth } from '../../context/AuthContext';

function setup({ user = { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } } } = {}) {
  useAuth.mockReturnValue({ user });
  server.use(
    http.get('/api/tables/mine', () =>
      HttpResponse.json({ tables: [{ _id: 't1', boardGame: 'Catán', status: 'open' }] }),
    ),
  );
  return render(
    <MemoryRouter>
      <CreateCompartidaForm onCreated={vi.fn()} onCancel={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('<CreateCompartidaForm>', () => {
  it('renders title + body inputs + the photo button', async () => {
    setup();
    expect(screen.getByPlaceholderText(/título/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /foto/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /publicar compartida/i })).toBeInTheDocument();
  });

  it('submit button is disabled when all fields are empty', () => {
    setup();
    expect(screen.getByRole('button', { name: /publicar compartida/i })).toBeDisabled();
  });

  it('typing a body enables the submit button', () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i), {
      target: { value: 'Anoche jugamos…' },
    });
    expect(screen.getByRole('button', { name: /publicar compartida/i })).not.toBeDisabled();
  });

  it('shows validation error when submitting completely empty (defensive)', () => {
    setup();
    // canSubmit guard prevents submission via the disabled state; force a submit anyway
    // via form submit event to exercise the inline validation branch.
    const form = screen.getByPlaceholderText(/título/i).closest('form');
    fireEvent.submit(form);
    expect(screen.getByText(/agreg[aá] al menos un título, texto o foto/i)).toBeInTheDocument();
  });

  it('changes privacy when clicking a privacy button', () => {
    setup();
    const friendsBtn = screen.getByRole('button', { name: 'Amigos' });
    fireEvent.click(friendsBtn);
    expect(friendsBtn.className).toMatch(/active/i);
  });

  it('cancel button calls onCancel', () => {
    const onCancel = vi.fn();
    useAuth.mockReturnValue({ user: { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } } });
    server.use(http.get('/api/tables/mine', () => HttpResponse.json({ tables: [] })));
    render(
      <MemoryRouter>
        <CreateCompartidaForm onCreated={vi.fn()} onCancel={onCancel} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('on success creates a compartida and calls onCreated', async () => {
    const onCreated = vi.fn();
    useAuth.mockReturnValue({ user: { _id: 'me', username: 'me', avatar: { url: '', publicId: '' } } });
    server.use(
      http.get('/api/tables/mine', () => HttpResponse.json({ tables: [] })),
      http.post('/api/compartidas', () =>
        HttpResponse.json({ _id: 'new', body: 'Anoche jugamos', images: [] }),
      ),
    );
    render(
      <MemoryRouter>
        <CreateCompartidaForm onCreated={onCreated} onCancel={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i), {
      target: { value: 'Anoche jugamos' },
    });
    fireEvent.click(screen.getByRole('button', { name: /publicar compartida/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(onCreated.mock.calls[0][0]._id).toBe('new');
  });
});
