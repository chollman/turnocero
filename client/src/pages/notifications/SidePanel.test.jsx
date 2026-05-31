import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import SidePanel from "./SidePanel";

const now = new Date().toISOString();

describe("<SidePanel>", () => {
  it("derives unread / actionable / today / total stats", () => {
    render(
      <SidePanel
        notifications={[
          { type: "chat", tableId: "t1", read: false, updatedAt: now },
          {
            type: "friend_request",
            fromUserId: "u1",
            read: false,
            updatedAt: now,
          },
          { type: "chat", tableId: "t2", read: true, updatedAt: now },
        ]}
      />,
    );
    // Sin leer = 2
    expect(
      within(screen.getByText("Sin leer").closest("div")).getByText("2"),
    ).toBeInTheDocument();
    // Requieren acción = 1 (friend_request unread)
    expect(
      within(screen.getByText("Requieren acción").closest("div")).getByText(
        "1",
      ),
    ).toBeInTheDocument();
    // Total activas = 3
    expect(
      within(screen.getByText("Total activas").closest("div")).getByText("3"),
    ).toBeInTheDocument();
  });

  it("renders a breakdown row per domain present", () => {
    render(
      <SidePanel
        notifications={[
          { type: "chat", tableId: "t1", read: false, updatedAt: now },
          {
            type: "tournament_started",
            torneoId: "x",
            read: false,
            updatedAt: now,
          },
        ]}
      />,
    );
    // 2 domains (mesa + torneo) → 2 bars, each with its count "1".
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(2);
  });

  it("renders without breakdown when there are no notifications", () => {
    render(<SidePanel notifications={[]} />);
    expect(screen.getByText("Total activas")).toBeInTheDocument();
  });
});
