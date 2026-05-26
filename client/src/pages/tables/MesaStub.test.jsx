import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MesaStub from "./MesaStub";

function makeTable(overrides = {}) {
  return {
    _id: "t1",
    boardGame: "Catán",
    date: new Date(Date.now() + 5 * 86400000).toISOString(),
    maxPlayers: 3,
    players: [],
    location: { texto: "Buenos Aires", lat: null, lng: null },
    privacy: "public",
    status: "open",
    pendingRequests: [],
    ...overrides,
  };
}

describe("<MesaStub>", () => {
  it("renders the date block, time, and meta rows", () => {
    render(<MesaStub table={makeTable()} userState="idle" />);
    expect(screen.getByText("Catán")).toBeInTheDocument();
    expect(screen.getByText("Buenos Aires")).toBeInTheDocument();
    // Seat ratio for default: 1/4 (host counts).
    expect(screen.getByText("1/4")).toBeInTheDocument();
    expect(screen.getByText(/Pública/)).toBeInTheDocument();
  });

  it('idle state shows "Unirme a la mesa" CTA for public tables', () => {
    render(<MesaStub table={makeTable()} userState="idle" onJoin={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /unirme/i }),
    ).toBeInTheDocument();
  });

  it('idle state shows "Solicitar lugar" for private tables', () => {
    render(
      <MesaStub
        table={makeTable({ privacy: "private" })}
        userState="idle"
        onJoin={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /solicitar lugar/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Privada/)).toBeInTheDocument();
  });

  it('hosting state shows "Sos el host" + admin actions + pending count', () => {
    render(
      <MesaStub
        table={makeTable()}
        userState="hosting"
        pendingCount={2}
        onEdit={vi.fn()}
        onCancelMesa={vi.fn()}
      />,
    );
    expect(screen.getByText(/sos el host/i)).toBeInTheDocument();
    expect(screen.getByText(/2 solicitudes pendientes/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /editar/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancelar/i }),
    ).toBeInTheDocument();
  });

  it("hosting cancel mesa requires a confirm step", () => {
    const onCancelMesa = vi.fn();
    render(
      <MesaStub
        table={makeTable()}
        userState="hosting"
        onEdit={vi.fn()}
        onCancelMesa={onCancelMesa}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(screen.getByText(/cancelar esta mesa\?/i)).toBeInTheDocument();
    expect(onCancelMesa).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^Sí$/i }));
    expect(onCancelMesa).toHaveBeenCalled();
  });

  it('joined state shows "Estás dentro" + Abandonar', () => {
    render(<MesaStub table={makeTable()} userState="joined" onLeave={vi.fn()} />);
    expect(screen.getByText(/estás dentro/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /abandonar/i }),
    ).toBeInTheDocument();
  });

  it("joined → Abandonar opens a confirm popover", () => {
    render(<MesaStub table={makeTable()} userState="joined" onLeave={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /abandonar/i }));
    expect(screen.getByText(/abandonar\?/i)).toBeInTheDocument();
  });

  it('pending state shows "Solicitud enviada" + Cancelar', () => {
    render(
      <MesaStub
        table={makeTable()}
        userState="pending"
        onCancelRequest={vi.fn()}
      />,
    );
    expect(screen.getByText(/solicitud enviada/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancelar solicitud/i }),
    ).toBeInTheDocument();
  });

  it('full state (no spot left) shows disabled "Mesa llena"', () => {
    render(
      <MesaStub
        table={makeTable({ maxPlayers: 1, players: [{ _id: "p1" }] })}
        userState="idle"
      />,
    );
    const cta = screen.getByRole("button", { name: /mesa llena/i });
    expect(cta).toBeDisabled();
  });

  it("cancelled mesa shows disabled CTA", () => {
    render(
      <MesaStub
        table={makeTable({ status: "cancelled" })}
        userState="idle"
      />,
    );
    expect(
      screen.getByRole("button", { name: /mesa cancelada/i }),
    ).toBeDisabled();
  });

  it('anon state shows "Iniciá sesión para unirte"', () => {
    const onLogin = vi.fn();
    render(
      <MesaStub
        table={makeTable()}
        userState="anon"
        onLoginRequest={onLogin}
      />,
    );
    const btn = screen.getByRole("button", { name: /iniciá sesión/i });
    fireEvent.click(btn);
    expect(onLogin).toHaveBeenCalled();
  });
});
