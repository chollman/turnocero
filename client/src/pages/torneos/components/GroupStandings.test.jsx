import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GroupStandings from "./GroupStandings";

const players = [
  { _id: "p1", username: "alice", avatar: { url: "", publicId: "" } },
  { _id: "p2", username: "bob", avatar: { url: "", publicId: "" } },
  { _id: "p3", username: "carol", avatar: { url: "", publicId: "" } },
];

function renderTable(props) {
  return render(
    <MemoryRouter>
      <GroupStandings
        gamesPerGroup={3}
        qualifiersPerGroup={2}
        players={players}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("<GroupStandings>", () => {
  it("renders an empty state when no rows", () => {
    renderTable({ standings: [] });
    expect(screen.getByText(/no hay partidas jugadas/i)).toBeInTheDocument();
  });

  it("renders one row per standing with PV totals", () => {
    renderTable({
      standings: [
        { user: "p1", played: 3, totalPV: 30, byGame: [10, 12, 8] },
        { user: "p2", played: 3, totalPV: 24, byGame: [8, 9, 7] },
      ],
    });
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
  });

  it("marks the top qualifiers with the leader class (qualifiersPerGroup=2)", () => {
    const { container } = renderTable({
      standings: [
        { user: "p1", played: 3, totalPV: 30, byGame: [10, 12, 8] },
        { user: "p2", played: 3, totalPV: 24, byGame: [8, 9, 7] },
        { user: "p3", played: 3, totalPV: 12, byGame: [4, 4, 4] },
      ],
    });
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0].className).toMatch(/leader|rowLeader/i);
    expect(rows[1].className).toMatch(/leader|rowLeader/i);
    expect(rows[2].className).not.toMatch(/leader|rowLeader/i);
  });

  it("renders one column per game (P1..Pn)", () => {
    renderTable({
      standings: [{ user: "p1", played: 3, totalPV: 30, byGame: [10, 12, 8] }],
      gamesPerGroup: 4,
    });
    expect(screen.getByText("P1")).toBeInTheDocument();
    expect(screen.getByText("P2")).toBeInTheDocument();
    expect(screen.getByText("P3")).toBeInTheDocument();
    expect(screen.getByText("P4")).toBeInTheDocument();
  });

  it('renders "—" for byGame entries that are null', () => {
    renderTable({
      standings: [
        { user: "p1", played: 1, totalPV: 10, byGame: [10, null, null] },
      ],
    });
    const cells = screen.getAllByText("—");
    expect(cells.length).toBe(2);
  });
});
