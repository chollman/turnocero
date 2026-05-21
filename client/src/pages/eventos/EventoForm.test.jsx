import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

// PlaceAutocomplete tiene su propio test — acá lo simplificamos a un input.
vi.mock("../../components/shared/PlaceAutocomplete", () => ({
  default: ({ value, onChange, placeholder }) => (
    <input
      data-testid="place-autocomplete"
      aria-label="lugar"
      value={value || ""}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

import EventoForm from "./EventoForm";
import { useAuth } from "../../context/AuthContext";

beforeEach(() => {
  // Default: sin direccion. Tests específicos sobreescriben.
  useAuth.mockReturnValue({ user: { _id: "me", username: "me" } });
});

// Wrapper helper para no repetir MemoryRouter en cada render. Recibe el JSX
// directamente para que los tests existentes solo cambien `render` → `renderForm`.
function renderForm(jsx) {
  return render(<MemoryRouter>{jsx}</MemoryRouter>);
}

describe("<EventoForm>", () => {
  it("renders all main fields in create mode", () => {
    renderForm(
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
    renderForm(
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
    renderForm(
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
    renderForm(
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
    renderForm(
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
    renderForm(
      <EventoForm mode="create" onSubmit={() => {}} onCancel={() => {}} />,
    );
    const dateInput = screen.getByLabelText(/fecha y hora/i);
    expect(dateInput.getAttribute("aria-required")).toBe("true");
    // Label includes asterisk
    expect(screen.getByText(/fecha y hora \*/i)).toBeInTheDocument();
  });

  it("calls onSubmit with FormData containing the expected keys", async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    renderForm(
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
    // location es obligatoria desde 2026-05 — el mock de PlaceAutocomplete
    // expone aria-label "lugar".
    fireEvent.change(screen.getByLabelText(/^lugar$/i), {
      target: { value: "Bar Pepe" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crear evento/i }));
    await new Promise((r) => {
      setTimeout(r, 0);
    });
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
    renderForm(
      <EventoForm mode="create" onSubmit={() => {}} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while submitting", () => {
    renderForm(
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

  it("serializes location as JSON string in FormData", async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    renderForm(
      <EventoForm
        mode="edit"
        initialEvento={{
          title: "Liga",
          eventDate: "2026-06-13T17:00:00",
          location: { texto: "Bar X", lat: -34.6, lng: -58.4 },
        }}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await new Promise((r) => setTimeout(r, 0));
    const fd = onSubmit.mock.calls[0][0];
    const locJson = fd.get("location");
    expect(locJson).toBe(JSON.stringify({ texto: "Bar X", lat: -34.6, lng: -58.4 }));
  });

  it("normalizes a legacy string location into the subdoc when seeded", () => {
    renderForm(
      <EventoForm
        mode="edit"
        initialEvento={{
          title: "X",
          eventDate: "2026-06-13T17:00:00",
          location: "Bar viejo",  // legacy string
        }}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByTestId("place-autocomplete")).toHaveValue("Bar viejo");
  });

  it("location es obligatoria: bloquea submit si está vacía y muestra error", async () => {
    const onSubmit = vi.fn();
    renderForm(
      <EventoForm mode="create" onSubmit={onSubmit} onCancel={() => {}} />,
    );
    // Lleno título y fecha pero NO lugar.
    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: "Sin lugar" } });
    fireEvent.change(screen.getByLabelText(/fecha y hora/i), {
      target: { value: "2027-01-01T20:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crear evento/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/lugar.*obligatorio/i),
    ).toBeInTheDocument();
  });

  it("label de Lugar muestra asterisco (obligatorio), no '(opcional)'", () => {
    renderForm(
      <EventoForm mode="create" onSubmit={() => {}} onCancel={() => {}} />,
    );
    // El label "Lugar *" debe estar.
    expect(screen.getByText(/lugar \*/i)).toBeInTheDocument();
    // No debe decir "(opcional)" en el contexto del lugar.
    expect(screen.queryByText(/usamos la dirección de tu perfil/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/se publica sin ubicación/i)).not.toBeInTheDocument();
  });

  it("revoca la object URL cuando el form se desmonta (regresión: memory leak)", () => {
    const createSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:fake");
    const revokeSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});

    try {
      const { unmount, container } = renderForm(
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
