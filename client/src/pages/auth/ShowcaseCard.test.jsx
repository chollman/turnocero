import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ShowcaseCard from "./ShowcaseCard";

const table = {
  boardGame: "Wingspan",
  host: { username: "cami" },
  location: { texto: "Bar Notable, Almagro, CABA" },
  date: "2026-06-10T20:00:00.000Z",
  players: [{ _id: "p1" }, { _id: "p2" }],
  maxPlayers: 3,
};

describe("<ShowcaseCard>", () => {
  it("renders the game, host and available seats", () => {
    render(<ShowcaseCard table={table} />);
    expect(screen.getByText("Wingspan")).toBeInTheDocument();
    // host (1) + 2 players = 3 filled of 4 total → 1 seat free.
    expect(screen.getByText(/1 lugar\b/)).toBeInTheDocument();
    expect(screen.getByText(/cami/)).toBeInTheDocument();
  });

  it("pluralizes seats correctly when more than one is free", () => {
    render(<ShowcaseCard table={{ ...table, players: [], maxPlayers: 5 }} />);
    // host (1) of 6 total → 5 free.
    expect(screen.getByText(/5 lugares/)).toBeInTheDocument();
  });
});
