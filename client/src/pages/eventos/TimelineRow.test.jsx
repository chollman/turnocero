import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TimelineRow from "./TimelineRow";

function makeEvento(overrides = {}) {
  return {
    _id: "e1",
    title: "Torneo de Catán",
    description: "Una linda descripción.",
    eventDate: "2030-06-13T17:00:00",
    location: "Bar La Torre",
    fee: 3500,
    maxParticipants: 24,
    registrationCount: { total: 17, pending: 0, confirmed: 17 },
    status: "open",
    author: { _id: "u1", username: "cami", displayName: "Cami", avatar: null },
    ...overrides,
  };
}

function renderRow(props = {}) {
  return render(
    <MemoryRouter>
      <TimelineRow
        evento={props.evento ?? makeEvento(props.event)}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("<TimelineRow>", () => {
  it("renders title, location, and capacity", () => {
    renderRow();
    expect(screen.getByText("Torneo de Catán")).toBeInTheDocument();
    expect(screen.getByText("Bar La Torre")).toBeInTheDocument();
    expect(screen.getByText(/17\/24 inscriptos/)).toBeInTheDocument();
  });

  it("formats fee as Argentine pesos", () => {
    renderRow();
    expect(screen.getByText(/\$3\.500/)).toBeInTheDocument();
  });

  it('shows "Gratis" when fee is 0', () => {
    renderRow({ event: { fee: 0 } });
    expect(screen.getByText("Gratis")).toBeInTheDocument();
  });

  it("wraps the entire row in a single link to the detail page", () => {
    const { container } = renderRow();
    const links = container.querySelectorAll("a");
    expect(links.length).toBe(1);
    expect(links[0].getAttribute("href")).toBe("/eventos/e1");
    expect(links[0].getAttribute("aria-label")).toMatch(/torneo de catán/i);
  });

  it('always shows "Más info!" as the CTA label', () => {
    const { rerender } = renderRow();
    expect(screen.getByText(/más info!/i)).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <TimelineRow evento={makeEvento({ status: "cancelled" })} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/más info!/i)).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <TimelineRow evento={makeEvento()} userRegistrationStatus="confirmed" />
      </MemoryRouter>,
    );
    expect(screen.getByText(/más info!/i)).toBeInTheDocument();
  });

  it("shows host badge when isHost is true", () => {
    renderRow({ isHost: true });
    expect(screen.getByText("Sos host")).toBeInTheDocument();
  });

  it("shows Inscripto badge when user is confirmed", () => {
    renderRow({ userRegistrationStatus: "confirmed" });
    expect(screen.getByText("Inscripto")).toBeInTheDocument();
  });

  it("shows Pendiente badge when user has pending registration", () => {
    renderRow({ userRegistrationStatus: "pending" });
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
  });

  it('shows "Sin cupo" badge when event is full and open', () => {
    renderRow({
      event: { registrationCount: { total: 24, pending: 0, confirmed: 24 } },
    });
    expect(screen.getByText("Sin cupo")).toBeInTheDocument();
  });

  it("counts pending inscriptions toward the cupo progress (regression)", () => {
    // 0 confirmadas + 10 pendientes = 10/24 — el bar debe avanzar antes de la confirmación del admin.
    renderRow({
      event: { registrationCount: { total: 10, pending: 10, confirmed: 0 } },
    });
    expect(screen.getByText(/10\/24 inscriptos/)).toBeInTheDocument();
    expect(screen.getByText("10/24 cupos")).toBeInTheDocument();
  });

  it('reaches "Sin cupo" with only pending inscriptions', () => {
    renderRow({
      event: { registrationCount: { total: 24, pending: 24, confirmed: 0 } },
    });
    expect(screen.getByText("Sin cupo")).toBeInTheDocument();
  });

  it("shows cancelled status", () => {
    renderRow({ event: { status: "cancelled" } });
    expect(screen.getByText("Cancelado")).toBeInTheDocument();
  });

  it("shows draft status", () => {
    renderRow({ event: { status: "draft" } });
    expect(screen.getByText("Borrador")).toBeInTheDocument();
  });

  it("shows closed status without crashing", () => {
    renderRow({ event: { status: "closed" } });
    expect(screen.getByText("Cerrado")).toBeInTheDocument();
  });

  it("renders without maxParticipants (open cupo)", () => {
    renderRow({
      event: {
        maxParticipants: null,
        registrationCount: { total: 42, pending: 5, confirmed: 37 },
      },
    });
    // Active count only: pending + confirmed (excluye rejected y permanentemente rechazados)
    expect(screen.getByText(/42 inscripciones/)).toBeInTheDocument();
  });

  it("does NOT count permanently-rejected users in the inscriptos label (regression)", () => {
    // total=10 includes the 3 permanently-rejected. Display should show 7, not 10.
    renderRow({
      event: {
        maxParticipants: null,
        registrationCount: { total: 10, pending: 2, confirmed: 5 },
      },
    });
    expect(screen.getByText(/^7 inscripciones$/)).toBeInTheDocument();
    expect(screen.queryByText(/10 inscripciones/)).not.toBeInTheDocument();
  });

  it("with cupo: rejected users do not occupy slots in the bar", () => {
    // 20 cupos, 4 rejected (don't count), 5 pending + 3 confirmed = 8 active
    renderRow({
      event: {
        maxParticipants: 20,
        registrationCount: { total: 12, pending: 5, confirmed: 3 },
      },
    });
    expect(screen.getByText(/8\/20 inscriptos/)).toBeInTheDocument();
    expect(screen.getByText("8/20 cupos")).toBeInTheDocument();
  });

  it("does not render countdown when event is past", () => {
    renderRow({
      event: { eventDate: "2020-01-01T00:00:00", status: "closed" },
    });
    expect(screen.queryByText(/^en /)).not.toBeInTheDocument();
  });

  it("renders the author name in the host line", () => {
    renderRow();
    expect(screen.getByText("Cami")).toBeInTheDocument();
  });
});
