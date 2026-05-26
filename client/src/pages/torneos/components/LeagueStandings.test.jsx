import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LeagueStandings from "./LeagueStandings";

const playersBase = [
  {
    _id: "p1",
    username: "alice",
    displayName: "Alice A",
    avatar: { url: "", publicId: "" },
  },
  {
    _id: "p2",
    username: "bob",
    displayName: "Bob B",
    avatar: { url: "", publicId: "" },
  },
  {
    _id: "p3",
    username: "carol",
    displayName: "Carol C",
    avatar: { url: "", publicId: "" },
  },
];

describe("<LeagueStandings>", () => {
  it("renders an empty state when there are no rows", () => {
    render(<LeagueStandings standings={[]} participants={playersBase} />);
    expect(screen.getByText(/no hay partidos jugados/i)).toBeInTheDocument();
  });

  it("renders one row per standing with player names from the participants lookup", () => {
    render(
      <MemoryRouter>
        <LeagueStandings
          standings={[
            { user: "p1", played: 3, won: 2, drawn: 1, lost: 0, points: 7 },
            { user: "p2", played: 3, won: 1, drawn: 1, lost: 1, points: 4 },
            { user: "p3", played: 3, won: 0, drawn: 0, lost: 3, points: 0 },
          ]}
          participants={playersBase}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Alice A")).toBeInTheDocument();
    expect(screen.getByText("Bob B")).toBeInTheDocument();
    expect(screen.getByText("Carol C")).toBeInTheDocument();
  });

  it("renders the PJ / G / E / P / Pts columns with values from each row", () => {
    const { container } = render(
      <MemoryRouter>
        <LeagueStandings
          standings={[
            { user: "p1", played: 5, won: 4, drawn: 7, lost: 6, points: 13 },
          ]}
          participants={playersBase}
        />
      </MemoryRouter>,
    );
    const cells = [...container.querySelectorAll("tbody td")].map(
      (td) => td.textContent,
    );
    expect(cells).toContain("5");
    expect(cells).toContain("4");
    expect(cells).toContain("7");
    expect(cells).toContain("6");
    expect(cells).toContain("13");
  });

  it("marks the leader row visually (CSS class)", () => {
    const { container } = render(
      <MemoryRouter>
        <LeagueStandings
          standings={[
            { user: "p1", played: 3, won: 3, drawn: 0, lost: 0, points: 9 },
            { user: "p2", played: 3, won: 0, drawn: 0, lost: 3, points: 0 },
          ]}
          participants={playersBase}
        />
      </MemoryRouter>,
    );
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0].className).toMatch(/leader|rowLeader/i);
    expect(rows[1].className).not.toMatch(/leader|rowLeader/i);
  });
});
