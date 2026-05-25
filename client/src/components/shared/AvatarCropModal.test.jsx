import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock react-easy-crop: render a placeholder + immediately invoke onCropComplete
// with deterministic pixel coords so the Save button enables.
vi.mock("react-easy-crop", () => ({
  default: ({ onCropComplete, onCropChange, onZoomChange }) => {
    // Trigger onCropComplete on mount so croppedAreaPixels is set.
    setTimeout(() => {
      onCropComplete?.(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 10, y: 20, width: 200, height: 200 },
      );
    }, 0);
    return (
      <div data-testid="mock-cropper">
        <button onClick={() => onCropChange?.({ x: 5, y: 5 })}>
          simulate-drag
        </button>
        <button onClick={() => onZoomChange?.(2)}>simulate-zoom</button>
      </div>
    );
  },
}));

// Image constructor in jsdom doesn't fire onload by default; force it.
beforeEach(() => {
  Object.defineProperty(Image.prototype, "src", {
    configurable: true,
    set() {
      setTimeout(() => this.onload?.(), 0);
    },
  });
});

import AvatarCropModal from "./AvatarCropModal";

function makeFile(name = "avatar.jpg") {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" });
}

describe("<AvatarCropModal>", () => {
  it("renders nothing when open is false", () => {
    const { container } = render(
      <AvatarCropModal
        open={false}
        file={null}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when file is null", () => {
    const { container } = render(
      <AvatarCropModal open onCancel={() => {}} onConfirm={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders header + cropper + zoom slider + actions when open with a file", () => {
    render(
      <AvatarCropModal
        open
        file={makeFile()}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(
      screen.getByRole("dialog", { name: "Recortar avatar" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Recortar avatar")).toBeInTheDocument();
    expect(screen.getByTestId("mock-cropper")).toBeInTheDocument();
    expect(screen.getByLabelText("Zoom")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancelar" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });

  it("Cancel triggers onCancel", () => {
    const onCancel = vi.fn();
    render(
      <AvatarCropModal
        open
        file={makeFile()}
        onCancel={onCancel}
        onConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Save is initially disabled (no crop data yet) and becomes enabled after the cropper reports pixels", async () => {
    const onConfirm = vi.fn();
    render(
      <AvatarCropModal
        open
        file={makeFile()}
        onCancel={() => {}}
        onConfirm={onConfirm}
      />,
    );
    const save = screen.getByRole("button", { name: "Guardar" });
    // Initially disabled
    expect(save).toBeDisabled();
    // After the mocked Cropper fires onCropComplete asynchronously, Save becomes enabled.
    await waitFor(() => expect(save).not.toBeDisabled());
  });

  it("Save produces a blob and calls onConfirm with it", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <AvatarCropModal
        open
        file={makeFile()}
        onCancel={() => {}}
        onConfirm={onConfirm}
      />,
    );
    const save = screen.getByRole("button", { name: "Guardar" });
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    // The stubbed canvas.toBlob returns a generic Blob; only assert shape.
    const blob = onConfirm.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
  });

  it("zoom slider updates the internal zoom state", () => {
    render(
      <AvatarCropModal
        open
        file={makeFile()}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    const slider = screen.getByLabelText("Zoom");
    expect(slider).toHaveValue("1");
    fireEvent.change(slider, { target: { value: "2.5" } });
    expect(slider).toHaveValue("2.5");
  });
});
