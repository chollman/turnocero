import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImageDropzone from './ImageDropzone';

function makeFile(name, type = 'image/png') {
  return new File(['dummy'], name, { type });
}

describe('<ImageDropzone>', () => {
  it('renders placeholder when there is no preview', () => {
    render(<ImageDropzone preview="" onFile={() => {}} />);
    expect(screen.getByText(/arrastrá, pegá o hacé click/i)).toBeInTheDocument();
    expect(screen.getByText(/JPG · PNG · WEBP/i)).toBeInTheDocument();
  });

  it('renders image when preview prop is provided', () => {
    render(<ImageDropzone preview="https://example.com/x.jpg" onFile={() => {}} />);
    const img = screen.getByAltText('preview');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('https://example.com/x.jpg');
  });

  it('calls onFile when a file is selected via input', () => {
    const onFile = vi.fn();
    const { container } = render(<ImageDropzone preview="" onFile={onFile} />);
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [makeFile('a.png')] } });
    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile.mock.calls[0][0]).toBeInstanceOf(File);
  });

  it('calls onFile when a file is dropped', () => {
    const onFile = vi.fn();
    const { container } = render(<ImageDropzone preview="" onFile={onFile} />);
    const dz = container.firstChild;
    fireEvent.drop(dz, { dataTransfer: { files: [makeFile('drop.webp', 'image/webp')] } });
    expect(onFile).toHaveBeenCalledTimes(1);
  });

  it('opens file picker when clicked', () => {
    const { container } = render(<ImageDropzone preview="" onFile={() => {}} />);
    const dz = container.firstChild;
    const input = container.querySelector('input[type="file"]');
    const click = vi.spyOn(input, 'click');
    fireEvent.click(dz);
    expect(click).toHaveBeenCalled();
  });

  it('toggles drag-over visual state', () => {
    const { container } = render(<ImageDropzone preview="" onFile={() => {}} />);
    const dz = container.firstChild;
    fireEvent.dragOver(dz);
    // dragOver class added; we don't assert specific class name (CSS Modules hash),
    // but className mutates
    expect(dz.className).toMatch(/dragOver/);
    fireEvent.dragLeave(dz);
    expect(dz.className).not.toMatch(/dragOver/);
  });
});
