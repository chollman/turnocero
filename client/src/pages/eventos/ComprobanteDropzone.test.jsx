import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ComprobanteDropzone from './ComprobanteDropzone';

function makeFile(name, type) {
  return new File(['x'], name, { type });
}

beforeEach(() => {
  if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => 'blob://x');
  if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn();
});

describe('<ComprobanteDropzone>', () => {
  it('renders empty state when no file', () => {
    render(<ComprobanteDropzone file={null} onFile={() => {}} />);
    expect(screen.getByText(/arrastrá o hacé click/i)).toBeInTheDocument();
    expect(screen.getByText(/JPG · PNG · PDF/i)).toBeInTheDocument();
  });

  it('shows PDF label for PDF files', () => {
    const f = makeFile('comprobante.pdf', 'application/pdf');
    render(<ComprobanteDropzone file={f} onFile={() => {}} />);
    expect(screen.getByText('comprobante.pdf')).toBeInTheDocument();
    expect(screen.getByText(/click para cambiar/i)).toBeInTheDocument();
  });

  it('shows image preview for image files', () => {
    const f = makeFile('foto.png', 'image/png');
    render(<ComprobanteDropzone file={f} onFile={() => {}} />);
    const img = screen.getByAltText('comprobante');
    expect(img).toBeInTheDocument();
  });

  it('triggers onFile when file is selected via input', () => {
    const onFile = vi.fn();
    const { container } = render(<ComprobanteDropzone file={null} onFile={onFile} />);
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [makeFile('a.pdf', 'application/pdf')] } });
    expect(onFile).toHaveBeenCalled();
  });

  it('triggers onFile when file is dropped', () => {
    const onFile = vi.fn();
    const { container } = render(<ComprobanteDropzone file={null} onFile={onFile} />);
    const dz = container.firstChild;
    fireEvent.drop(dz, { dataTransfer: { files: [makeFile('drop.png', 'image/png')] } });
    expect(onFile).toHaveBeenCalled();
  });
});
