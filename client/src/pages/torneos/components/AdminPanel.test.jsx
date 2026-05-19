import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/server';

import AdminPanel from './AdminPanel';

function makeTorneo(overrides = {}) {
  return {
    _id: 't1',
    status: 'draft',
    inscriptionMode: 'open',
    participants: [],
    ...overrides,
  };
}

function renderPanel({
  torneo = makeTorneo(),
  onChange = vi.fn(),
  onReorderSeeds = vi.fn(),
  onAddParticipants = vi.fn(),
  onDelete = vi.fn(),
} = {}) {
  return render(
    <MemoryRouter>
      <AdminPanel
        torneo={torneo}
        onChange={onChange}
        onReorderSeeds={onReorderSeeds}
        onAddParticipants={onAddParticipants}
        onDelete={onDelete}
      />
    </MemoryRouter>,
  );
}

describe('<AdminPanel>', () => {
  it('renders the admin badge + Edit link to /torneos/:id/editar', () => {
    renderPanel();
    expect(screen.getByText('Panel admin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/torneos/t1/editar');
  });

  it('draft → shows "Abrir inscripciones" as the next action', () => {
    renderPanel({ torneo: makeTorneo({ status: 'draft' }) });
    expect(screen.getByRole('button', { name: /abrir inscripciones/i })).toBeInTheDocument();
  });

  it('registration → shows "Iniciar torneo" and "Volver a borrador"', () => {
    renderPanel({ torneo: makeTorneo({ status: 'registration' }) });
    expect(screen.getByRole('button', { name: /iniciar torneo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volver a borrador/i })).toBeInTheDocument();
  });

  it('in_progress → shows "Finalizar torneo" + Reset button', () => {
    renderPanel({ torneo: makeTorneo({ status: 'in_progress' }) });
    expect(screen.getByRole('button', { name: /finalizar torneo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reiniciar torneo/i })).toBeInTheDocument();
  });

  it('finished → no "next" button + still allows reset', () => {
    renderPanel({ torneo: makeTorneo({ status: 'finished' }) });
    expect(screen.queryByRole('button', { name: /abrir inscripciones/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^iniciar torneo$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^finalizar torneo$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reiniciar torneo/i })).toBeInTheDocument();
  });

  it('admin_only inscription mode + draft → shows "+ Agregar participantes"', () => {
    renderPanel({ torneo: makeTorneo({ status: 'draft', inscriptionMode: 'admin_only' }) });
    expect(screen.getByRole('button', { name: /agregar participantes/i })).toBeInTheDocument();
  });

  it('"Reordenar seeds" is disabled when fewer than 2 participants', () => {
    renderPanel({ torneo: makeTorneo({ status: 'draft', participants: [{ _id: 'p1' }] }) });
    expect(screen.getByRole('button', { name: /reordenar seeds/i })).toBeDisabled();
  });

  it('"Reordenar seeds" calls onReorderSeeds when clicked with enough participants', () => {
    const onReorderSeeds = vi.fn();
    renderPanel({
      torneo: makeTorneo({ status: 'draft', participants: [{ _id: 'p1' }, { _id: 'p2' }] }),
      onReorderSeeds,
    });
    fireEvent.click(screen.getByRole('button', { name: /reordenar seeds/i }));
    expect(onReorderSeeds).toHaveBeenCalled();
  });

  it('Eliminar: confirm flow Sí calls DELETE + onDelete', async () => {
    const onDelete = vi.fn();
    server.use(http.delete('/api/torneos/:id', () => HttpResponse.json({ ok: true })));
    renderPanel({ onDelete });

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(screen.getByText(/eliminar\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sí' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalled());
  });

  it('"Iniciar torneo" requires confirmation', async () => {
    const onChange = vi.fn();
    server.use(http.patch('/api/torneos/:id/status', () => HttpResponse.json({ ok: true })));
    renderPanel({ torneo: makeTorneo({ status: 'registration' }), onChange });

    fireEvent.click(screen.getByRole('button', { name: /iniciar torneo/i }));
    expect(screen.getByText(/generar fixture/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sí, iniciar/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it('"Volver a borrador" calls PATCH /status directly (no confirm)', async () => {
    const onChange = vi.fn();
    server.use(http.patch('/api/torneos/:id/status', () => HttpResponse.json({ ok: true })));
    renderPanel({ torneo: makeTorneo({ status: 'registration' }), onChange });

    fireEvent.click(screen.getByRole('button', { name: /volver a borrador/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it('"Iniciar torneo": clicking Cancelar in confirmation dismisses it', async () => {
    renderPanel({ torneo: makeTorneo({ status: 'registration' }) });
    fireEvent.click(screen.getByRole('button', { name: /iniciar torneo/i }));
    expect(screen.getByText(/generar fixture/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^cancelar$/i }));
    // Confirmation gone, button back
    expect(screen.queryByText(/generar fixture/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar torneo/i })).toBeInTheDocument();
  });

  it('"Finalizar torneo" shows confirmation inline', async () => {
    renderPanel({ torneo: makeTorneo({ status: 'in_progress' }) });
    fireEvent.click(screen.getByRole('button', { name: /finalizar torneo/i }));
    expect(screen.getByText(/¿finalizar el torneo\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sí, finalizar/i })).toBeInTheDocument();
  });

  it('"Finalizar torneo": Sí, finalizar calls PATCH and onChange', async () => {
    const onChange = vi.fn();
    server.use(http.patch('/api/torneos/:id/status', () => HttpResponse.json({ status: 'finished' })));
    renderPanel({ torneo: makeTorneo({ status: 'in_progress' }), onChange });
    fireEvent.click(screen.getByRole('button', { name: /finalizar torneo/i }));
    fireEvent.click(screen.getByRole('button', { name: /sí, finalizar/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it('"Finalizar torneo": clicking Cancelar dismisses confirmation', async () => {
    renderPanel({ torneo: makeTorneo({ status: 'in_progress' }) });
    fireEvent.click(screen.getByRole('button', { name: /finalizar torneo/i }));
    expect(screen.getByText(/¿finalizar el torneo\?/i)).toBeInTheDocument();
    // There are two Cancelar buttons (one for reset confirm if shown, one here). Use getAll.
    const cancelBtns = screen.getAllByRole('button', { name: /^cancelar$/i });
    fireEvent.click(cancelBtns[0]);
    expect(screen.queryByText(/¿finalizar el torneo\?/i)).not.toBeInTheDocument();
  });

  it('"↻ Reiniciar torneo": clicking shows reset confirmation', async () => {
    renderPanel({ torneo: makeTorneo({ status: 'in_progress' }) });
    fireEvent.click(screen.getByRole('button', { name: /reiniciar torneo/i }));
    expect(screen.getByText(/se borrarán todas las partidas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sí, reiniciar/i })).toBeInTheDocument();
  });

  it('"↻ Reiniciar torneo": Cancelar hides confirmation', async () => {
    renderPanel({ torneo: makeTorneo({ status: 'in_progress' }) });
    fireEvent.click(screen.getByRole('button', { name: /reiniciar torneo/i }));
    expect(screen.getByText(/se borrarán todas las partidas/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^cancelar$/i }));
    expect(screen.queryByText(/se borrarán todas las partidas/i)).not.toBeInTheDocument();
  });

  it('"↻ Reiniciar torneo": Sí, reiniciar calls POST /reset and onChange', async () => {
    const onChange = vi.fn();
    server.use(http.post('/api/torneos/:id/reset', () => HttpResponse.json({ status: 'in_progress' })));
    renderPanel({ torneo: makeTorneo({ status: 'in_progress' }), onChange });
    fireEvent.click(screen.getByRole('button', { name: /reiniciar torneo/i }));
    fireEvent.click(screen.getByRole('button', { name: /sí, reiniciar/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it('PATCH /status error shows error message', async () => {
    server.use(
      http.patch('/api/torneos/:id/status', () =>
        HttpResponse.json({ message: 'No se puede iniciar' }, { status: 400 }),
      ),
    );
    renderPanel({ torneo: makeTorneo({ status: 'draft' }) });
    fireEvent.click(screen.getByRole('button', { name: /abrir inscripciones/i }));
    await waitFor(() => expect(screen.getByText(/no se puede iniciar/i)).toBeInTheDocument());
  });
});
