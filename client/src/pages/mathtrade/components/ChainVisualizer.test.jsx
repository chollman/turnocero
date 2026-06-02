import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AllProviders } from "../../../test/wrappers/AllProviders";
import ChainVisualizer from "./ChainVisualizer";

const cycle = {
  length: 2,
  items: [
    {
      itemId: "a",
      owner: { _id: "u1", username: "ana" },
      gameId: 1,
      gameName: "Catan",
      receivesItemId: "b",
      receivesGameId: 2,
      receivesGameName: "Wingspan",
    },
    {
      itemId: "b",
      owner: { _id: "u2", username: "beto" },
      gameId: 2,
      gameName: "Wingspan",
      receivesItemId: "a",
      receivesGameId: 1,
      receivesGameName: "Catan",
    },
  ],
};

describe("ChainVisualizer", () => {
  it("muestra cada miembro con lo que entrega y recibe", () => {
    render(<ChainVisualizer cycle={cycle} />, { wrapper: AllProviders });
    expect(screen.getByText(/Cadena de 2 personas/)).toBeInTheDocument();
    expect(screen.getAllByText("Catan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wingspan").length).toBeGreaterThan(0);
  });

  it("marca al usuario destacado con (vos)", () => {
    render(<ChainVisualizer cycle={cycle} highlightUserId="u1" />, {
      wrapper: AllProviders,
    });
    expect(screen.getByText(/\(vos\)/)).toBeInTheDocument();
  });

  it("no renderiza nada sin ítems", () => {
    const { container } = render(<ChainVisualizer cycle={{ items: [] }} />, {
      wrapper: AllProviders,
    });
    expect(container.firstChild).toBeNull();
  });
});
