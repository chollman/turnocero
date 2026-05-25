import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";

import ParticipantsList from "./ParticipantsList";

function makeTorneo(overrides = {}) {
  return {
    _id: "t1",
    status: "draft",
    participants: [
      { _id: "p1", username: "alice", avatar: { url: "", publicId: "" } },
      { _id: "p2", username: "bob", avatar: { url: "", publicId: "" } },
    ],
    ...overrides,
  };
}

function renderList({
  torneo = makeTorneo(),
  isAdmin = true,
  onChange = vi.fn(),
} = {}) {
  return render(
    <MemoryRouter>
      <ParticipantsList torneo={torneo} isAdmin={isAdmin} onChange={onChange} />
    </MemoryRouter>,
  );
}

describe("<ParticipantsList>", () => {
  it("renders an empty state when there are no participants", () => {
    renderList({ torneo: makeTorneo({ participants: [] }) });
    expect(
      screen.getByText(/no hay participantes inscriptos/i),
    ).toBeInTheDocument();
  });

  it("renders one item per participant with #seed", () => {
    renderList();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it('admin in draft/registration phase sees "Quitar" buttons', () => {
    renderList({ isAdmin: true, torneo: makeTorneo({ status: "draft" }) });
    const removeButtons = screen.getAllByRole("button", { name: /quitar/i });
    expect(removeButtons.length).toBe(2);
  });

  it('admin in in_progress phase does NOT see "Quitar" (no more removals after start)', () => {
    renderList({
      isAdmin: true,
      torneo: makeTorneo({ status: "in_progress" }),
    });
    expect(
      screen.queryByRole("button", { name: /quitar/i }),
    ).not.toBeInTheDocument();
  });

  it('regular users never see "Quitar"', () => {
    renderList({ isAdmin: false });
    expect(
      screen.queryByRole("button", { name: /quitar/i }),
    ).not.toBeInTheDocument();
  });

  it("clicking Quitar shows Sí/No confirm, Sí calls DELETE + onChange", async () => {
    const onChange = vi.fn();
    server.use(
      http.delete("/api/torneos/:id/participants/:userId", () =>
        HttpResponse.json({ participants: [] }),
      ),
    );
    renderList({ onChange });
    fireEvent.click(screen.getAllByRole("button", { name: /quitar/i })[0]);
    expect(screen.getByRole("button", { name: "Sí" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sí" }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it("clicking No cancels the confirm without calling DELETE", () => {
    const onChange = vi.fn();
    renderList({ onChange });
    fireEvent.click(screen.getAllByRole("button", { name: /quitar/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(onChange).not.toHaveBeenCalled();
    // Back to "Quitar" buttons
    expect(screen.getAllByRole("button", { name: /quitar/i }).length).toBe(2);
  });
});
