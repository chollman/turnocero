import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";

import RegistrationsList from "./RegistrationsList";

function makeTorneo(overrides = {}) {
  return {
    _id: "t1",
    pendingRegistrations: [
      {
        user: {
          _id: "u1",
          username: "alice",
          avatar: { url: "", publicId: "" },
        },
        requestedAt: new Date().toISOString(),
      },
      {
        user: { _id: "u2", username: "bob", avatar: { url: "", publicId: "" } },
        requestedAt: new Date().toISOString(),
      },
    ],
    ...overrides,
  };
}

function renderList({ torneo = makeTorneo(), onChange = vi.fn() } = {}) {
  return render(
    <MemoryRouter>
      <RegistrationsList torneo={torneo} onChange={onChange} />
    </MemoryRouter>,
  );
}

describe("<RegistrationsList>", () => {
  it("renders empty state when no pending registrations", () => {
    renderList({ torneo: makeTorneo({ pendingRegistrations: [] }) });
    expect(
      screen.getByText(/no hay inscripciones pendientes/i),
    ).toBeInTheDocument();
  });

  it("renders one row per pending registration with Aceptar/Rechazar buttons", () => {
    renderList();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /aceptar/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /rechazar/i })).toHaveLength(
      2,
    );
  });

  it("clicking Aceptar POSTs to /accept and calls onChange", async () => {
    const onChange = vi.fn();
    server.use(
      http.post("/api/torneos/:id/registrations/:userId/accept", () =>
        HttpResponse.json({ participants: [{ _id: "u1" }] }),
      ),
    );
    renderList({ onChange });
    fireEvent.click(screen.getAllByRole("button", { name: /aceptar/i })[0]);
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it("clicking Rechazar POSTs to /reject and calls onChange", async () => {
    const onChange = vi.fn();
    server.use(
      http.post("/api/torneos/:id/registrations/:userId/reject", () =>
        HttpResponse.json({ rejectedRegistrations: [{ user: "u1" }] }),
      ),
    );
    renderList({ onChange });
    fireEvent.click(screen.getAllByRole("button", { name: /rechazar/i })[0]);
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });
});
