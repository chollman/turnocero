import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock del buscador BGG: un botón que "elige" un juego fijo.
vi.mock("../../../components/shared/BggGameSearch", () => ({
  default: ({ onPick }) => (
    <button
      type="button"
      onClick={() => onPick({ id: 99, name: "Azul", thumbnail: "" })}
    >
      mock-add
    </button>
  ),
}));

import WantListBuilder from "./WantListBuilder";

const wants = [
  { bggGameId: 1, gameName: "Catan" },
  { bggGameId: 2, gameName: "Wingspan" },
];

describe("WantListBuilder", () => {
  it("lista los wants en orden con su rank", () => {
    render(<WantListBuilder wants={wants} onChange={() => {}} />);
    expect(screen.getByText("Catan")).toBeInTheDocument();
    expect(screen.getByText("Wingspan")).toBeInTheDocument();
  });

  it("agrega un juego nuevo vía el buscador", () => {
    const onChange = vi.fn();
    render(<WantListBuilder wants={wants} onChange={onChange} />);
    fireEvent.click(screen.getByText("mock-add"));
    expect(onChange).toHaveBeenCalledWith([
      ...wants,
      { bggGameId: 99, gameName: "Azul", thumbnail: "" },
    ]);
  });

  it("no agrega duplicados", () => {
    const onChange = vi.fn();
    render(
      <WantListBuilder
        wants={[{ bggGameId: 99, gameName: "Azul" }]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("mock-add"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("quita un want", () => {
    const onChange = vi.fn();
    render(<WantListBuilder wants={wants} onChange={onChange} />);
    fireEvent.click(screen.getAllByLabelText("Quitar")[0]);
    expect(onChange).toHaveBeenCalledWith([wants[1]]);
  });

  it("reordena con las flechas", () => {
    const onChange = vi.fn();
    render(<WantListBuilder wants={wants} onChange={onChange} />);
    fireEvent.click(screen.getAllByLabelText("Bajar preferencia")[0]);
    expect(onChange).toHaveBeenCalledWith([wants[1], wants[0]]);
  });
});
