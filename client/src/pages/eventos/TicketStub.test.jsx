import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TicketStub from "./TicketStub";

function makeEvento(overrides = {}) {
  return {
    _id: "e1",
    title: "X",
    eventDate: "2026-06-13T17:00:00",
    fee: 3500,
    maxParticipants: 24,
    transferDetails: "Alias: turnocero",
    conditions: "Llegar 15 minutos antes",
    registrationCount: { total: 17, pending: 0, confirmed: 17 },
    status: "open",
    ...overrides,
  };
}

const noop = () => {};

describe("<TicketStub>", () => {
  it("renders date block and fee", () => {
    render(
      <TicketStub
        evento={makeEvento()}
        user={{ _id: "u1" }}
        onInscribirse={noop}
      />,
    );
    expect(screen.getByText("13")).toBeInTheDocument();
    expect(screen.getByText("Junio")).toBeInTheDocument();
    expect(screen.getAllByText(/\$3\.500/).length).toBeGreaterThan(0);
  });

  it("shows login button when user is not authenticated", () => {
    const onLogin = vi.fn();
    render(
      <TicketStub
        evento={makeEvento()}
        user={null}
        onLoginRequest={onLogin}
        onInscribirse={noop}
      />,
    );
    const btn = screen.getByRole("button", { name: /iniciá sesión/i });
    fireEvent.click(btn);
    expect(onLogin).toHaveBeenCalled();
  });

  it('shows "Inscribirme" CTA for logged-in users and reveals form on click', () => {
    render(
      <TicketStub
        evento={makeEvento()}
        user={{ _id: "u1" }}
        onInscribirse={noop}
      />,
    );
    const btn = screen.getByRole("button", { name: /inscribirme/i });
    fireEvent.click(btn);
    expect(screen.getByText(/datos de transferencia/i)).toBeInTheDocument();
    expect(screen.getByText(/comprobante \*/i)).toBeInTheDocument();
  });

  it("skips comprobante for free events", () => {
    render(
      <TicketStub
        evento={makeEvento({ fee: 0 })}
        user={{ _id: "u1" }}
        onInscribirse={noop}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /inscribirme/i }));
    expect(screen.queryByText(/comprobante \*/i)).not.toBeInTheDocument();
    // Confirmar should be enabled (free + no comprobante required)
    expect(
      screen.getByRole("button", { name: /confirmar/i }),
    ).not.toBeDisabled();
  });

  it("shows the confirmed state when userRegistration.status is confirmed", () => {
    render(
      <TicketStub
        evento={makeEvento()}
        user={{ _id: "u1" }}
        userRegistration={{ status: "confirmed" }}
        onInscribirse={noop}
      />,
    );
    expect(screen.getByText(/inscripción confirmada/i)).toBeInTheDocument();
  });

  it("shows the pending state with cancel button when status is pending", () => {
    render(
      <TicketStub
        evento={makeEvento()}
        user={{ _id: "u1" }}
        userRegistration={{ status: "pending" }}
        onInscribirse={noop}
        onCancelRegistration={noop}
      />,
    );
    expect(screen.getByText(/pendiente de revisión/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancelar inscripción/i }),
    ).toBeInTheDocument();
  });

  it("shows the rejected state when status is rejected", () => {
    render(
      <TicketStub
        evento={makeEvento()}
        user={{ _id: "u1" }}
        userRegistration={{ status: "rejected" }}
        onInscribirse={noop}
      />,
    );
    expect(screen.getByText(/inscripción rechazada/i)).toBeInTheDocument();
  });

  it("shows host admin actions when isHost is true", () => {
    const onOpenInscripciones = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <TicketStub
        evento={makeEvento()}
        user={{ _id: "u1" }}
        isHost
        pendingCount={3}
        onOpenInscripciones={onOpenInscripciones}
        onEdit={onEdit}
        onDelete={onDelete}
        onInscribirse={noop}
      />,
    );
    const manage = screen.getByRole("button", {
      name: /gestionar inscripciones/i,
    });
    expect(manage).toBeInTheDocument();
    expect(manage.textContent).toMatch(/3 pendientes/);
    fireEvent.click(manage);
    expect(onOpenInscripciones).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /editar/i }));
    expect(onEdit).toHaveBeenCalled();
  });

  it('shows "Reabrir" instead of "Cancelar" when the cancelled event has onReopen', () => {
    const onReopen = vi.fn();
    render(
      <TicketStub
        evento={makeEvento({ status: "cancelled" })}
        user={{ _id: "u1" }}
        isHost
        onReopen={onReopen}
        onInscribirse={noop}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /^cancelar$/i }),
    ).not.toBeInTheDocument();
    const reopen = screen.getByRole("button", { name: /reabrir/i });
    fireEvent.click(reopen);
    expect(onReopen).toHaveBeenCalled();
  });

  it('shows "Inscripciones cerradas" for closed events when user not registered', () => {
    render(
      <TicketStub
        evento={makeEvento({ status: "closed" })}
        user={{ _id: "u1" }}
        onInscribirse={noop}
      />,
    );
    expect(
      screen.getByRole("button", { name: /inscripciones cerradas/i }),
    ).toBeDisabled();
  });

  it('shows "Evento cancelado" for cancelled events when user not registered', () => {
    render(
      <TicketStub
        evento={makeEvento({ status: "cancelled" })}
        user={{ _id: "u1" }}
        onInscribirse={noop}
      />,
    );
    expect(
      screen.getByRole("button", { name: /evento cancelado/i }),
    ).toBeDisabled();
  });

  it("disables CTA when event is full", () => {
    render(
      <TicketStub
        evento={makeEvento({
          registrationCount: { total: 24, pending: 0, confirmed: 24 },
        })}
        user={{ _id: "u1" }}
        onInscribirse={noop}
      />,
    );
    expect(screen.getByRole("button", { name: /sin cupo/i })).toBeDisabled();
  });

  it("calls onInscribirse with comprobante when submitting paid event form", async () => {
    const onInscribirse = vi.fn().mockResolvedValue();
    render(
      <TicketStub
        evento={makeEvento()}
        user={{ _id: "u1" }}
        onInscribirse={onInscribirse}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /inscribirme/i }));

    const dz = screen.getByRole("button", { name: /subir comprobante/i });
    // Simulate file drop
    const file = new File(["x"], "comp.pdf", { type: "application/pdf" });
    fireEvent.drop(dz, { dataTransfer: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    await new Promise((r) => {
      setTimeout(r, 0);
    });
    expect(onInscribirse).toHaveBeenCalledTimes(1);
    expect(onInscribirse.mock.calls[0][0]).toBeInstanceOf(File);
  });
});
