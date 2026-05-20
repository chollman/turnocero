import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InscItem from './InscItem';

function makeReg(overrides = {}) {
  return {
    _id: 'r1',
    user: { _id: 'u1', username: 'cami', displayName: 'Cami Rossi', avatar: null },
    status: 'pending',
    submittedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    comprobante: { url: 'https://example.com/c.pdf', resourceType: 'raw' },
    ...overrides,
  };
}

describe('<InscItem>', () => {
  it('renders user info, submitted time and comprobante link for pending', () => {
    render(<InscItem reg={makeReg()} onAccept={() => {}} onReject={() => {}} onUndo={() => {}} />);
    expect(screen.getByText('Cami Rossi')).toBeInTheDocument();
    expect(screen.getByText('@cami')).toBeInTheDocument();
    expect(screen.getByText(/hace 1h/i)).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
  });

  it('shows "Sin comprobante adjunto" when no comprobante and pending', () => {
    render(<InscItem reg={makeReg({ comprobante: null })} onAccept={() => {}} onReject={() => {}} onUndo={() => {}} />);
    expect(screen.getByText(/sin comprobante adjunto/i)).toBeInTheDocument();
  });

  it('calls onAccept when confirm clicked', async () => {
    const onAccept = vi.fn().mockResolvedValue();
    render(<InscItem reg={makeReg()} onAccept={onAccept} onReject={() => {}} onUndo={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await new Promise(r => setTimeout(r, 0));
    expect(onAccept).toHaveBeenCalled();
  });

  it('calls onReject when reject clicked', async () => {
    const onReject = vi.fn().mockResolvedValue();
    render(<InscItem reg={makeReg()} onAccept={() => {}} onReject={onReject} onUndo={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /rechazar/i }));
    await new Promise(r => setTimeout(r, 0));
    expect(onReject).toHaveBeenCalled();
  });

  it('shows undo button for confirmed/rejected', () => {
    const onUndo = vi.fn();
    const { rerender } = render(
      <InscItem reg={makeReg({ status: 'confirmed', reviewedAt: new Date().toISOString() })} onAccept={() => {}} onReject={() => {}} onUndo={onUndo} />
    );
    expect(screen.getByRole('button', { name: /revertir/i })).toBeInTheDocument();
    rerender(<InscItem reg={makeReg({ status: 'rejected', reviewedAt: new Date().toISOString(), adminNotes: 'comprobante ilegible' })} onAccept={() => {}} onReject={() => {}} onUndo={onUndo} />);
    expect(screen.getByText(/comprobante ilegible/)).toBeInTheDocument();
  });

  it('allows toggling notes input', () => {
    render(<InscItem reg={makeReg()} onAccept={() => {}} onReject={() => {}} onUndo={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /agregar nota/i }));
    expect(screen.getByPlaceholderText(/notas internas/i)).toBeInTheDocument();
  });

  it('passes notes to onAccept', async () => {
    const onAccept = vi.fn().mockResolvedValue();
    render(<InscItem reg={makeReg()} onAccept={onAccept} onReject={() => {}} onUndo={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /agregar nota/i }));
    const input = screen.getByPlaceholderText(/notas internas/i);
    fireEvent.change(input, { target: { value: 'OK, ya está pagado' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await new Promise(r => setTimeout(r, 0));
    expect(onAccept).toHaveBeenCalledWith(expect.any(Object), 'OK, ya está pagado');
  });
});
