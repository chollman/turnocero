import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EventoForm from './EventoForm';

describe('<EventoForm>', () => {
  it('renders all main fields in create mode', () => {
    render(<EventoForm mode="create" onSubmit={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText(/título/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/descripción/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/condiciones/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/monto/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cupo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/datos de transferencia/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha y hora/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/lugar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/estado/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear evento/i })).toBeInTheDocument();
  });

  it('shows the "Editar evento" eyebrow in edit mode', () => {
    render(
      <EventoForm
        mode="edit"
        initialEvento={{
          title: 'X',
          fee: 1000,
          status: 'open',
          eventDate: '2026-06-13T17:00:00',
        }}
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText(/editar evento/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument();
  });

  it('seeds the form with initial values', () => {
    render(
      <EventoForm
        mode="edit"
        initialEvento={{
          title: 'Liga',
          description: 'desc',
          fee: 1500,
          location: 'Club',
          status: 'open',
          eventDate: '2026-06-07T14:00:00',
          maxParticipants: 16,
        }}
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByLabelText(/título/i)).toHaveValue('Liga');
    expect(screen.getByLabelText(/cupo/i)).toHaveValue(16);
  });

  it('blocks submission when title is empty and shows error', async () => {
    const onSubmit = vi.fn();
    render(<EventoForm mode="create" onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /crear evento/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/el título es obligatorio/i)).toBeInTheDocument();
  });

  it('calls onSubmit with FormData containing the expected keys', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    render(<EventoForm mode="create" onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: 'Mi evento' } });
    fireEvent.change(screen.getByLabelText(/monto/i), { target: { value: '2500' } });
    fireEvent.click(screen.getByRole('button', { name: /crear evento/i }));
    await new Promise(r => setTimeout(r, 0));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const fd = onSubmit.mock.calls[0][0];
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get('title')).toBe('Mi evento');
    expect(fd.get('fee')).toBe('2500');
    // status default
    expect(fd.get('status')).toBe('open');
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<EventoForm mode="create" onSubmit={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons while submitting', () => {
    render(<EventoForm mode="create" onSubmit={() => {}} onCancel={() => {}} submitting />);
    expect(screen.getByRole('button', { name: /creando/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled();
  });
});
