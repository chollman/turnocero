import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FileDropzone from "./FileDropzone";

function makeFile(name = "a.jpg", type = "image/jpeg") {
  return new File(["x"], name, { type });
}

describe("<FileDropzone>", () => {
  it("renders children and aria label", () => {
    render(
      <FileDropzone onFile={vi.fn()} ariaLabel="Subir cosa">
        <span>contenido</span>
      </FileDropzone>,
    );
    expect(screen.getByText("contenido")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Subir cosa" }),
    ).toBeInTheDocument();
  });

  it("calls onFile when the input changes", () => {
    const onFile = vi.fn();
    const { container } = render(
      <FileDropzone onFile={onFile} ariaLabel="x">
        <span>x</span>
      </FileDropzone>,
    );
    const input = container.querySelector('input[type="file"]');
    const f = makeFile();
    fireEvent.change(input, { target: { files: [f] } });
    expect(onFile).toHaveBeenCalledWith(f);
  });

  it("calls onFile when a file is dropped", () => {
    const onFile = vi.fn();
    render(
      <FileDropzone onFile={onFile} ariaLabel="x">
        <span>x</span>
      </FileDropzone>,
    );
    const f = makeFile();
    const target = screen.getByRole("button", { name: "x" });
    fireEvent.drop(target, { dataTransfer: { files: [f] } });
    expect(onFile).toHaveBeenCalledWith(f);
  });

  it("toggles dragOverClassName on dragover/dragleave", () => {
    const { container } = render(
      <FileDropzone
        onFile={vi.fn()}
        ariaLabel="x"
        className="base"
        dragOverClassName="hover"
      >
        <span>x</span>
      </FileDropzone>,
    );
    const div = container.firstChild;
    expect(div.className).toBe("base");
    fireEvent.dragOver(div);
    expect(div.className).toContain("hover");
    fireEvent.dragLeave(div);
    expect(div.className).toBe("base");
  });

  it("applies activeClassName when hasFile=true", () => {
    const { container } = render(
      <FileDropzone
        onFile={vi.fn()}
        ariaLabel="x"
        className="base"
        activeClassName="filled"
        hasFile
      >
        <span>x</span>
      </FileDropzone>,
    );
    expect(container.firstChild.className).toContain("filled");
  });

  it("supports render-prop children that receive { dragOver, hasFile }", () => {
    const { container } = render(
      <FileDropzone onFile={vi.fn()} ariaLabel="x" hasFile>
        {({ hasFile }) => <span>{hasFile ? "lleno" : "vacio"}</span>}
      </FileDropzone>,
    );
    expect(screen.getByText("lleno")).toBeInTheDocument();
    // dragOver inicial es false
    fireEvent.dragOver(container.firstChild);
    expect(screen.getByText("lleno")).toBeInTheDocument();
  });

  it("Enter/Space en el contenedor abre el file picker", () => {
    const { container } = render(
      <FileDropzone onFile={vi.fn()} ariaLabel="x">
        <span>x</span>
      </FileDropzone>,
    );
    const input = container.querySelector('input[type="file"]');
    const clickSpy = vi.spyOn(input, "click");
    const div = container.firstChild;

    // jsdom además del onKeyDown handler dispara un click sintético en el
    // div (por role="button"), así que la cantidad exacta de clicks no es
    // determinista; lo que nos importa es que el input.click() se haya
    // invocado en respuesta a cada tecla.
    fireEvent.keyDown(div, { key: "Enter" });
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockClear();
    fireEvent.keyDown(div, { key: " " });
    expect(clickSpy).toHaveBeenCalled();
  });

  it("teclas que no son Enter/Space no abren el file picker", () => {
    const { container } = render(
      <FileDropzone onFile={vi.fn()} ariaLabel="x">
        <span>x</span>
      </FileDropzone>,
    );
    const input = container.querySelector('input[type="file"]');
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.keyDown(container.firstChild, { key: "a" });
    expect(clickSpy).not.toHaveBeenCalled();
  });
});
