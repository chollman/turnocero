import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EventoForm from "./EventoForm";

describe("<EventoForm>", () => {
  it("renders all main fields in create mode", () => {
    render(
      <EventoForm mode="create" onSubmit={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByLabelText(/título/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/descripción/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/condiciones/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/monto/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cupo/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/datos de transferencia/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha y hora/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/lugar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/estado/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /crear evento/i }),
    ).toBeInTheDocument();
  });

  it('shows the "Editar evento" eyebrow in edit mode', () => {
    render(
      <EventoForm
        mode="edit"
        initialEvento={{
          title: "X",
          fee: 1000,
          status: "open",
          eventDate: "2026-06-13T17:00:00",
        }}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/editar evento/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /guardar cambios/i }),
    ).toBeInTheDocument();
  });

  it("seeds the form with initial values", () => {
    render(
      <EventoForm
        mode="edit"
        initialEvento={{
          title: "Liga",
          description: "desc",
          fee: 1500,
          location: "Club",
          status: "open",
          eventDate: "2026-06-07T14:00:00",
          maxParticipants: 16,
        }}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByLabelText(/título/i)).toHaveValue("Liga");
    expect(screen.getByLabelText(/cupo/i)).toHaveValue(16);
  });

  it("blocks submission when title is empty and shows error", async () => {
    const onSubmit = vi.fn();
    render(
      <EventoForm mode="create" onSubmit={onSubmit} onCancel={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /crear evento/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/el título es obligatorio/i),
    ).toBeInTheDocument();
  });

  it("blocks submission when eventDate is empty and shows error", async () => {
    const onSubmit = vi.fn();
    render(
      <EventoForm mode="create" onSubmit={onSubmit} onCancel={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText(/título/i), {
      target: { value: "Sin fecha" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crear evento/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/fecha y hora del evento son obligatorias/i),
    ).toBeInTheDocument();
  });

  it("marks the eventDate field as required (aria-required + visible asterisk)", () => {
    render(
      <EventoForm mode="create" onSubmit={() => {}} onCancel={() => {}} />,
    );
    const dateInput = screen.getByLabelText(/fecha y hora/i);
    expect(dateInput.getAttribute("aria-required")).toBe("true");
    // Label includes asterisk
    expect(screen.getByText(/fecha y hora \*/i)).toBeInTheDocument();
  });

  it("calls onSubmit with FormData containing the expected keys", async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    render(
      <EventoForm mode="create" onSubmit={onSubmit} onCancel={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText(/título/i), {
      target: { value: "Mi evento" },
    });
    fireEvent.change(screen.getByLabelText(/monto/i), {
      target: { value: "2500" },
    });
    fireEvent.change(screen.getByLabelText(/fecha y hora/i), {
      target: { value: "2026-12-31T20:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crear evento/i }));
    await new Promise((r) => setTimeout(r, 0));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const fd = onSubmit.mock.calls[0][0];
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get("title")).toBe("Mi evento");
    expect(fd.get("fee")).toBe("2500");
    // eventDate viaja como ISO UTC al server; el offset depende de la TZ del
    // host pero la fecha+hora local debe corresponder a 2026-12-31 20:00.
    const eventDateIso = fd.get("eventDate");
    expect(eventDateIso).toMatch(/Z$/);
    const sentDate = new Date(eventDateIso);
    expect(sentDate.getFullYear()).toBe(2026);
    expect(sentDate.getMonth()).toBe(11); // December
    expect(sentDate.getDate()).toBe(31);
    expect(sentDate.getHours()).toBe(20);
    expect(sentDate.getMinutes()).toBe(0);
    // status default
    expect(fd.get("status")).toBe("open");
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <EventoForm mode="create" onSubmit={() => {}} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while submitting", () => {
    render(
      <EventoForm
        mode="create"
        onSubmit={() => {}}
        onCancel={() => {}}
        submitting
      />,
    );
    expect(screen.getByRole("button", { name: /creando/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeDisabled();
  });

  it("revoca la object URL cuando el form se desmonta (regresión: memory leak)", () => {
    const createSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:fake");
    const revokeSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});

    try {
      const { unmount, container } = render(
        <EventoForm mode="create" onSubmit={() => {}} onCancel={() => {}} />,
      );
      // Simular file pick — el form pasa por su useEffect y crea la object URL.
      const fileInput = container.querySelector('input[type="file"]');
      const fakeFile = new File(["a"], "img.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [fakeFile] } });

      expect(createSpy).toHaveBeenCalledTimes(1);
      unmount();
      expect(revokeSpy).toHaveBeenCalledWith("blob:fake");
    } finally {
      createSpy.mockRestore();
      revokeSpy.mockRestore();
    }
  });
});
