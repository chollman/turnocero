import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useRef } from "react";
import useClickOutside from "./useClickOutside";

function Harness({ onOutside, enabled }) {
  const ref = useRef(null);
  useClickOutside(ref, onOutside, enabled);
  return (
    <div>
      <div ref={ref} data-testid="inside">
        <button data-testid="child">adentro</button>
      </div>
      <div data-testid="outside">afuera</div>
    </div>
  );
}

describe("useClickOutside", () => {
  it("dispara al hacer mousedown afuera", () => {
    const onOutside = vi.fn();
    const { getByTestId } = render(
      <Harness onOutside={onOutside} enabled />,
    );
    fireEvent.mouseDown(getByTestId("outside"));
    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  it("NO dispara al hacer mousedown adentro (ni en un hijo)", () => {
    const onOutside = vi.fn();
    const { getByTestId } = render(
      <Harness onOutside={onOutside} enabled />,
    );
    fireEvent.mouseDown(getByTestId("inside"));
    fireEvent.mouseDown(getByTestId("child"));
    expect(onOutside).not.toHaveBeenCalled();
  });

  it("no escucha cuando enabled es false", () => {
    const onOutside = vi.fn();
    const { getByTestId } = render(
      <Harness onOutside={onOutside} enabled={false} />,
    );
    fireEvent.mouseDown(getByTestId("outside"));
    expect(onOutside).not.toHaveBeenCalled();
  });

  it("usa siempre el último callback sin re-suscribir (no se queda con el viejo)", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { getByTestId, rerender } = render(
      <Harness onOutside={first} enabled />,
    );
    rerender(<Harness onOutside={second} enabled />);
    fireEvent.mouseDown(getByTestId("outside"));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
