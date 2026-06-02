import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AllProviders } from "../../../test/wrappers/AllProviders";
import UserBreakdown from "./UserBreakdown";

const items = [
  {
    _id: "i1",
    owner: { _id: "u1", username: "ana" },
    bggGameId: 1,
    gameName: "Catan",
    traded: true,
    matchedGameId: 2,
  },
  {
    _id: "i2",
    owner: { _id: "u2", username: "beto" },
    bggGameId: 2,
    gameName: "Wingspan",
    traded: true,
    matchedGameId: 1,
  },
  {
    _id: "i3",
    owner: { _id: "u3", username: "caro" },
    bggGameId: 3,
    gameName: "Azul",
    traded: false,
    matchedGameId: null,
  },
];

describe("UserBreakdown", () => {
  it("agrupa por usuario y muestra entrega/recibe", () => {
    render(<UserBreakdown items={items} />, { wrapper: AllProviders });
    expect(screen.getByText("ana")).toBeInTheDocument();
    expect(screen.getByText("beto")).toBeInTheDocument();
    expect(screen.getByText("caro")).toBeInTheDocument();
    // Catan aparece como lo que entrega ana y lo que recibe beto.
    expect(screen.getAllByText("Catan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wingspan").length).toBeGreaterThan(0);
  });

  it("marca los ítems sin match", () => {
    render(<UserBreakdown items={items} />, { wrapper: AllProviders });
    expect(screen.getByText(/sin match/)).toBeInTheDocument();
  });

  it("destaca al usuario actual con (vos)", () => {
    render(<UserBreakdown items={items} currentUserId="u1" />, {
      wrapper: AllProviders,
    });
    expect(screen.getByText(/ana \(vos\)/)).toBeInTheDocument();
  });

  it("cae a derivar de las cadenas si no hay items", () => {
    const cycles = [
      {
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
      },
    ];
    render(<UserBreakdown cycles={cycles} />, { wrapper: AllProviders });
    expect(screen.getByText("ana")).toBeInTheDocument();
    expect(screen.getByText("beto")).toBeInTheDocument();
  });
});
