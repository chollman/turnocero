import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import PositionBadge from "./PositionBadge";

const spanOf = (c) => c.querySelector("span");

describe("<PositionBadge>", () => {
  it("renderiza el número y no glitchea en el montaje inicial", () => {
    const { container } = render(<PositionBadge position={1} />);
    expect(spanOf(container).textContent).toBe("1");
    expect(spanOf(container).getAttribute("data-glitch")).toBeNull();
  });

  it("glitchea cuando el número cambia", () => {
    const { container, rerender } = render(<PositionBadge position={2} />);
    expect(spanOf(container).getAttribute("data-glitch")).toBeNull();
    rerender(<PositionBadge position={1} />);
    expect(spanOf(container).getAttribute("data-glitch")).toBe("on");
    expect(spanOf(container).textContent).toBe("1");
  });

  it("no glitchea si el rerender no cambia el número", () => {
    const { container, rerender } = render(<PositionBadge position={3} />);
    rerender(<PositionBadge position={3} />);
    expect(spanOf(container).getAttribute("data-glitch")).toBeNull();
  });

  it("vuelve a glitchear en cambios sucesivos", () => {
    const { container, rerender } = render(<PositionBadge position={1} />);
    rerender(<PositionBadge position={2} />);
    expect(spanOf(container).getAttribute("data-glitch")).toBe("on");
    rerender(<PositionBadge position={3} />);
    // Sigue "on" y el número se actualizó (remonta con key nuevo cada cambio).
    expect(spanOf(container).getAttribute("data-glitch")).toBe("on");
    expect(spanOf(container).textContent).toBe("3");
  });
});
