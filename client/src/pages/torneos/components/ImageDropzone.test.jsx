import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImageDropzone from './ImageDropzone';

function makeImageFile(name = 'pic.jpg') {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/jpeg' });
}

describe('<ImageDropzone>', () => {
  it('renders placeholder + helper text when no preview', () => {
    render(<ImageDropzone preview={null} onFile={vi.fn()} />);
    expect(screen.getByText(/arrastrá, pegá o hacé click/i)).toBeInTheDocument();
    expect(screen.getByText(/JPG, PNG, WEBP/i)).toBeInTheDocument();
  });

  it('renders the preview image when preview prop is set', () => {
    render(<ImageDropzone preview="https://x/img.png" onFile={vi.fn()} />);
    const img = screen.getByAltText('preview');
    expect(img).toHaveAttribute('src', 'https://x/img.png');
  });

  it('selecting a file via the hidden input calls onFile', () => {
    const onFile = vi.fn();
    const { container } = render(<ImageDropzone preview={null} onFile={onFile} />);
    const input = container.querySelector('input[type="file"]');
    const file = makeImageFile();
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('dropping a file fires onFile with that file', () => {
    const onFile = vi.fn();
    const { container } = render(<ImageDropzone preview={null} onFile={onFile} />);
    const dropzone = container.firstChild;
    const file = makeImageFile();
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('pasting an image into the document fires onFile (via paste handler)', () => {
    const onFile = vi.fn();
    render(<ImageDropzone preview={null} onFile={onFile} />);
    const file = makeImageFile();
    const pasteEvent = new Event('paste');
    pasteEvent.clipboardData = {
      items: [{ type: 'image/jpeg', getAsFile: () => file }],
    };
    document.dispatchEvent(pasteEvent);
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('drag-over event marks the dropzone as drag-over (visual cue)', () => {
    const { container } = render(<ImageDropzone preview={null} onFile={vi.fn()} />);
    const dropzone = container.firstChild;
    fireEvent.dragOver(dropzone);
    expect(dropzone.className).toMatch(/dragOver/i);
  });
});
