import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import useRovingRadioGroup from "./useRovingRadioGroup";

const ITEMS = ["a", "b", "c"];

function Group({ value, onChange }) {
  const group = useRovingRadioGroup({ items: ITEMS, value, onChange });
  return (
    <div role="radiogroup" aria-label="test">
      {ITEMS.map((it, i) => (
        <button
          key={it}
          {...group.getRadioProps(it, i)}
          onClick={() => onChange(it)}
        >
          {it}
        </button>
      ))}
    </div>
  );
}

describe("useRovingRadioGroup", () => {
  it("solo el seleccionado es tabbable (roving tabindex)", () => {
    render(<Group value="b" onChange={vi.fn()} />);
    expect(screen.getByText("a")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("b")).toHaveAttribute("tabindex", "0");
    expect(screen.getByText("c")).toHaveAttribute("tabindex", "-1");
  });

  it("sin selección, el primero es tabbable", () => {
    render(<Group value={null} onChange={vi.fn()} />);
    expect(screen.getByText("a")).toHaveAttribute("tabindex", "0");
  });

  it("marca aria-checked en el seleccionado", () => {
    render(<Group value="c" onChange={vi.fn()} />);
    expect(screen.getByText("c")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("a")).toHaveAttribute("aria-checked", "false");
  });

  it("ArrowRight selecciona el siguiente (con wrap)", () => {
    const onChange = vi.fn();
    render(<Group value="c" onChange={onChange} />);
    fireEvent.keyDown(screen.getByText("c"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("a"); // wrap c → a
  });

  it("ArrowLeft selecciona el anterior (con wrap)", () => {
    const onChange = vi.fn();
    render(<Group value="a" onChange={onChange} />);
    fireEvent.keyDown(screen.getByText("a"), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith("c"); // wrap a → c
  });

  it("Home/End van a los extremos", () => {
    const onChange = vi.fn();
    render(<Group value="b" onChange={onChange} />);
    fireEvent.keyDown(screen.getByText("b"), { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("a");
    fireEvent.keyDown(screen.getByText("b"), { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith("c");
  });

  it("ignora otras teclas", () => {
    const onChange = vi.fn();
    render(<Group value="a" onChange={onChange} />);
    fireEvent.keyDown(screen.getByText("a"), { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });
});
