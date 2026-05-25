import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import InscItem from "./InscItem";

function makeReg(overrides = {}) {
  return {
    _id: "r1",
    user: {
      _id: "u1",
      username: "cami",
      displayName: "Cami Rossi",
      avatar: null,
    },
    status: "pending",
    submittedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    comprobante: { url: "https://example.com/c.pdf", resourceType: "raw" },
    ...overrides,
  };
}

describe("<InscItem>", () => {
  it("renders user info, submitted time and comprobante link for pending", () => {
    render(
      <InscItem
        reg={makeReg()}
        onAccept={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
      />,
    );
    expect(screen.getByText("Cami Rossi")).toBeInTheDocument();
    expect(screen.getByText("@cami")).toBeInTheDocument();
    expect(screen.getByText(/hace 1h/i)).toBeInTheDocument();
    expect(screen.getByText("PDF")).toBeInTheDocument();
  });

  it('shows "Sin comprobante adjunto" when no comprobante and pending', () => {
    render(
      <InscItem
        reg={makeReg({ comprobante: null })}
        onAccept={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
      />,
    );
    expect(screen.getByText(/sin comprobante adjunto/i)).toBeInTheDocument();
  });

  it("calls onAccept when confirm clicked", async () => {
    const onAccept = vi.fn().mockResolvedValue();
    render(
      <InscItem
        reg={makeReg()}
        onAccept={onAccept}
        onReject={() => {}}
        onUndo={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    await new Promise((r) => {
      setTimeout(r, 0);
    });
    expect(onAccept).toHaveBeenCalled();
  });

  it('calls onReject with permanent=false when "Rechazar" clicked', async () => {
    const onReject = vi.fn().mockResolvedValue();
    render(
      <InscItem
        reg={makeReg()}
        onAccept={() => {}}
        onReject={onReject}
        onUndo={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^rechazar$/i }));
    await new Promise((r) => {
      setTimeout(r, 0);
    });
    expect(onReject).toHaveBeenCalled();
    expect(onReject.mock.calls[0][2]).toBe(false);
  });

  it('calls onReject with permanent=true when "Bloquear del evento" clicked', async () => {
    const onReject = vi.fn().mockResolvedValue();
    render(
      <InscItem
        reg={makeReg()}
        onAccept={() => {}}
        onReject={onReject}
        onUndo={() => {}}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /bloquear del evento/i }),
    );
    await new Promise((r) => {
      setTimeout(r, 0);
    });
    expect(onReject).toHaveBeenCalled();
    expect(onReject.mock.calls[0][2]).toBe(true);
  });

  it("rejected: muestra pill compacto y oculta detalles hasta que se expanda", () => {
    render(
      <InscItem
        reg={makeReg({
          status: "rejected",
          reviewedAt: new Date().toISOString(),
          permanentlyRejected: false,
        })}
        onAccept={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
      />,
    );
    // Pill compacto siempre visible
    expect(screen.getByText(/puede reintentar/i)).toBeInTheDocument();
    // Detalles ocultos por default
    expect(
      screen.queryByText(/puede volver a intentar/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /revertir/i }),
    ).not.toBeInTheDocument();
    // Click en "Ver detalles" los revela
    fireEvent.click(screen.getByRole("button", { name: /ver detalles/i }));
    expect(screen.getByText(/puede volver a intentar/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /revertir/i }),
    ).toBeInTheDocument();
  });

  it("rejected (permanente): muestra pill bloqueado y revela label largo al expandir", () => {
    render(
      <InscItem
        reg={makeReg({
          status: "rejected",
          reviewedAt: new Date().toISOString(),
          permanentlyRejected: true,
        })}
        onAccept={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
      />,
    );
    expect(screen.getByText(/bloqueado/i)).toBeInTheDocument();
    expect(screen.queryByText(/bloqueado del evento/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ver detalles/i }));
    expect(screen.getByText(/bloqueado del evento/i)).toBeInTheDocument();
  });

  it("confirmed: muestra pill compacto y revela undo + notas al expandir", () => {
    const onUndo = vi.fn();
    render(
      <InscItem
        reg={makeReg({
          status: "confirmed",
          reviewedAt: new Date().toISOString(),
          adminNotes: "Pago recibido por transferencia",
        })}
        onAccept={() => {}}
        onReject={() => {}}
        onUndo={onUndo}
      />,
    );
    expect(screen.getByText(/confirmada/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/pago recibido por transferencia/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /revertir/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ver detalles/i }));
    expect(
      screen.getByText(/pago recibido por transferencia/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /revertir/i }),
    ).toBeInTheDocument();
  });

  it('toggle alterna entre "Ver detalles" y "Ocultar detalles"', () => {
    render(
      <InscItem
        reg={makeReg({
          status: "confirmed",
          reviewedAt: new Date().toISOString(),
        })}
        onAccept={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
      />,
    );
    const toggle = screen.getByRole("button", { name: /ver detalles/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(
      screen.getByRole("button", { name: /ocultar detalles/i }),
    ).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: /ocultar detalles/i }));
    expect(
      screen.getByRole("button", { name: /ver detalles/i }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("pending (primero, index=0): vista completa sin toggle", () => {
    render(
      <InscItem
        reg={makeReg()}
        index={0}
        onAccept={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /ver detalles/i }),
    ).not.toBeInTheDocument();
    // Pending muestra el botón Rechazar directamente, sin necesitar expandir
    expect(
      screen.getByRole("button", { name: /^rechazar$/i }),
    ).toBeInTheDocument();
  });

  it("pending (siguientes, index>0): vista compacta con toggle", () => {
    render(
      <InscItem
        reg={makeReg()}
        index={1}
        onAccept={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
      />,
    );
    // Pill compacto visible, sin Rechazar/Confirmar aún
    expect(screen.getByText(/pendiente/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^rechazar$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^confirmar$/i }),
    ).not.toBeInTheDocument();
    // Click en "Ver detalles" revela acciones
    fireEvent.click(screen.getByRole("button", { name: /ver detalles/i }));
    expect(
      screen.getByRole("button", { name: /^rechazar$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^confirmar$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /bloquear del evento/i }),
    ).toBeInTheDocument();
  });

  it("pending colapsado: index default (0) sigue mostrando vista completa", () => {
    // Regresión: tests existentes que no pasan `index` deben seguir funcionando
    render(
      <InscItem
        reg={makeReg()}
        onAccept={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /ver detalles/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^confirmar$/i }),
    ).toBeInTheDocument();
  });

  it("allows toggling notes input", () => {
    render(
      <InscItem
        reg={makeReg()}
        onAccept={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /agregar nota/i }));
    expect(screen.getByPlaceholderText(/notas internas/i)).toBeInTheDocument();
  });

  it("passes notes to onAccept", async () => {
    const onAccept = vi.fn().mockResolvedValue();
    render(
      <InscItem
        reg={makeReg()}
        onAccept={onAccept}
        onReject={() => {}}
        onUndo={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /agregar nota/i }));
    const input = screen.getByPlaceholderText(/notas internas/i);
    fireEvent.change(input, { target: { value: "OK, ya está pagado" } });
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    await new Promise((r) => {
      setTimeout(r, 0);
    });
    expect(onAccept).toHaveBeenCalledWith(
      expect.any(Object),
      "OK, ya está pagado",
    );
  });
});
