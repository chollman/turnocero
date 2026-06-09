import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TopCollectionWidget from "./TopCollectionWidget";

const GAMES = [
  { id: "1", name: "Wingspan", numPlays: 14 },
  { id: "2", name: "Brass", numPlays: 11 },
  { id: "3", name: "Catán", numPlays: 9 },
  { id: "4", name: "Ark Nova", numPlays: 6 },
  { id: "5", name: "Heat", numPlays: 4 },
  { id: "6", name: "Splendor", numPlays: 2 },
];

function renderWidget(games) {
  return render(
    <MemoryRouter>
      <TopCollectionWidget games={games} bggUsername="carca" />
    </MemoryRouter>,
  );
}

describe("<TopCollectionWidget>", () => {
  it("renders at most the top 5 games", () => {
    renderWidget(GAMES);
    expect(screen.getByText("Wingspan")).toBeInTheDocument();
    expect(screen.getByText("Heat")).toBeInTheDocument();
    // 6th game is cut.
    expect(screen.queryByText("Splendor")).toBeNull();
  });

  it("shows play counts", () => {
    renderWidget(GAMES);
    expect(screen.getByText("14×")).toBeInTheDocument();
    expect(screen.getByText("4×")).toBeInTheDocument();
  });

  it("links each game to its per-game view", () => {
    renderWidget(GAMES);
    const link = screen.getByRole("link", { name: /Wingspan/ });
    expect(link).toHaveAttribute("href", "/bg-watch/carca/juego/1");
  });

  it("renders nothing when there are no games", () => {
    const { container } = renderWidget([]);
    expect(container.firstChild).toBeNull();
  });

  it("handles a null games prop", () => {
    const { container } = renderWidget(null);
    expect(container.firstChild).toBeNull();
  });
});
