import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FeedCard from "./FeedCard";

vi.mock("../../components/shared/GameTile", () => ({
  default: ({ game }) => <div data-testid="game-tile">{game}</div>,
}));

function makeTable(overrides = {}) {
  return {
    _id: "t1",
    boardGame: "Catán",
    date: new Date("2026-06-01T18:00:00Z").toISOString(),
    maxPlayers: 4,
    players: [],
    location: "Buenos Aires",
    host: { _id: "host1", username: "host1" },
    ...overrides,
  };
}

function renderCard({
  table = makeTable(),
  userId = "host1",
  isPast = false,
} = {}) {
  return render(
    <MemoryRouter>
      <FeedCard table={table} userId={userId} isPast={isPast} />
    </MemoryRouter>,
  );
}

describe("<FeedCard>", () => {
  it("renders the game name and game tile", () => {
    renderCard();
    // Game name appears in both the title (top row) and the GameTile stub.
    expect(screen.getAllByText("Catán").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("game-tile")).toBeInTheDocument();
  });

  it("renders the HOST badge when current user is host", () => {
    renderCard({ table: makeTable({ host: { _id: "me" } }), userId: "me" });
    expect(screen.getByText("HOST")).toBeInTheDocument();
  });

  it("renders the JUGADOR badge when current user is not host", () => {
    renderCard({ table: makeTable({ host: { _id: "host1" } }), userId: "me" });
    expect(screen.getByText("JUGADOR")).toBeInTheDocument();
  });

  it("renders the meta line with location and player count", () => {
    renderCard({
      table: makeTable({
        location: "Córdoba",
        maxPlayers: 4,
        players: [{ _id: "p1" }],
      }),
    });
    expect(screen.getByText(/Córdoba/i)).toBeInTheDocument();
    expect(screen.getByText(/2\/5/)).toBeInTheDocument();
  });

  it('links "Ver →" to /mesas/:id', () => {
    renderCard();
    expect(screen.getByRole("link", { name: /Ver/i })).toHaveAttribute(
      "href",
      "/mesas/t1",
    );
  });

  it('applies "past" styling class when isPast=true', () => {
    const { container } = renderCard({ isPast: true });
    expect(container.firstChild.className).toMatch(/past|cardPast/i);
  });

  it("handles a populated host as an ObjectId string (no crash)", () => {
    renderCard({ table: makeTable({ host: "host1" }), userId: "host1" });
    expect(screen.getByText("HOST")).toBeInTheDocument();
  });
});
