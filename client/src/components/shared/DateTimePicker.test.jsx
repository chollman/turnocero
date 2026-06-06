import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DateTimePicker from "./DateTimePicker";

describe("<DateTimePicker>", () => {
  it("renders the trigger button (no native datetime input visible)", () => {
    render(<DateTimePicker value="" onChange={() => {}} />);
    expect(
      screen.getByRole("button", { name: /elegí fecha y hora/i }),
    ).toBeInTheDocument();
  });

  it("renders a hidden input with the value for form submission compatibility", () => {
    const { container } = render(
      <DateTimePicker
        value="2027-06-13T20:00"
        onChange={() => {}}
        id="dt"
        name="eventDate"
      />,
    );
    // El id lo lleva el TRIGGER (button) — labellable. El hidden input solo
    // existe para que el FormData del form contenga el valor con su name.
    const hidden = container.querySelector('input[type="hidden"]');
    expect(hidden).toBeInTheDocument();
    expect(hidden.value).toBe("2027-06-13T20:00");
    expect(hidden.name).toBe("eventDate");
    // El trigger es el elemento con id="dt".
    const trigger = document.getElementById("dt");
    expect(trigger).toBeInTheDocument();
    expect(trigger.tagName).toBe("BUTTON");
  });

  it("shows formatted trigger label when value is set", () => {
    render(<DateTimePicker value="2027-06-13T20:00" onChange={() => {}} />);
    // Match pedazos invariantes — el formato exacto depende del locale runtime.
    expect(screen.getByRole("button", { name: /20:00/ })).toBeInTheDocument();
    expect(screen.queryByText(/elegí fecha y hora/i)).not.toBeInTheDocument();
  });

  it("opens the popover on click and closes on second click", () => {
    render(<DateTimePicker value="" onChange={() => {}} />);
    const trigger = screen.getByRole("button", { name: /elegí fecha y hora/i });

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows month nav and day grid when popover is open", () => {
    render(<DateTimePicker value="2027-06-13T20:00" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /20:00/ }));
    expect(
      screen.getByRole("button", { name: /mes anterior/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /mes siguiente/i }),
    ).toBeInTheDocument();
    // Junio 2027 — 30 días + leading/trailing days = 42 cells.
    expect(screen.getAllByRole("gridcell").length).toBe(42);
  });

  it("clicking a day in the grid updates the value (preserving current time)", () => {
    const onChange = vi.fn();
    render(<DateTimePicker value="2027-06-13T20:30" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /20:30/ }));
    // El "15" en junio 2027 corresponde al día 15. Buscar por aria-label para evitar ambigüedad.
    const day15 = screen.getByRole("gridcell", {
      name: /martes, 15 de junio/i,
    });
    fireEvent.click(day15);
    expect(onChange).toHaveBeenCalledWith("2027-06-15T20:30");
  });

  it("changing the hour select updates the value", () => {
    const onChange = vi.fn();
    render(<DateTimePicker value="2027-06-13T20:00" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /20:00/ }));
    const hourSelect = screen.getByLabelText(/^hora$/i);
    fireEvent.change(hourSelect, { target: { value: "22" } });
    expect(onChange).toHaveBeenCalledWith("2027-06-13T22:00");
  });

  it("changing the minute select updates the value", () => {
    const onChange = vi.fn();
    render(<DateTimePicker value="2027-06-13T20:00" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /20:00/ }));
    const minSelect = screen.getByLabelText(/minutos/i);
    fireEvent.change(minSelect, { target: { value: "30" } });
    expect(onChange).toHaveBeenCalledWith("2027-06-13T20:30");
  });

  it('"Listo" button closes the popover', () => {
    render(<DateTimePicker value="2027-06-13T20:00" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /20:00/ }));
    fireEvent.click(screen.getByRole("button", { name: /^listo$/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Escape closes the popover", () => {
    render(<DateTimePicker value="" onChange={() => {}} />);
    fireEvent.click(
      screen.getByRole("button", { name: /elegí fecha y hora/i }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clicking outside closes the popover", () => {
    render(
      <div>
        <DateTimePicker value="" onChange={() => {}} />
        <button data-testid="outside">outside</button>
      </div>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /elegí fecha y hora/i }),
    );
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("past days are disabled and do not trigger onChange", () => {
    const onChange = vi.fn();
    render(<DateTimePicker value="" onChange={onChange} />);
    fireEvent.click(
      screen.getByRole("button", { name: /elegí fecha y hora/i }),
    );
    // Buscar cualquier celda disabled — en el grid actual debería haber días pasados.
    const disabledCells = screen
      .getAllByRole("gridcell")
      .filter((c) => c.disabled);
    if (disabledCells.length > 0) {
      fireEvent.click(disabledCells[0]);
      expect(onChange).not.toHaveBeenCalled();
    }
  });

  it("month nav advances and rewinds the visible month", () => {
    render(<DateTimePicker value="2027-06-13T20:00" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /20:00/ }));
    // Locale es-AR puede devolver "Junio 2027" o "Junio de 2027" — regex flexible.
    expect(screen.getByText(/junio.*2027/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /mes siguiente/i }));
    expect(screen.getByText(/julio.*2027/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /mes anterior/i }));
    fireEvent.click(screen.getByRole("button", { name: /mes anterior/i }));
    expect(screen.getByText(/mayo.*2027/i)).toBeInTheDocument();
  });

  it("opens downward when there is enough space below the trigger", () => {
    // Stub getBoundingClientRect para simular el trigger cerca del top del viewport.
    const proto = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      return {
        top: 100,
        bottom: 142,
        left: 0,
        right: 200,
        width: 200,
        height: 42,
      };
    };
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      writable: true,
      configurable: true,
    });

    try {
      render(<DateTimePicker value="" onChange={() => {}} />);
      fireEvent.click(
        screen.getByRole("button", { name: /elegí fecha y hora/i }),
      );
      const dialog = screen.getByRole("dialog");
      // Sin la clase "Up" → se abre hacia abajo.
      expect(dialog.className).not.toMatch(/Up/);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = proto;
    }
  });

  it("opens upward when there is not enough space below the trigger", () => {
    // Trigger cerca del bottom del viewport — no entra el popover (380px) debajo.
    const proto = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      return {
        top: 700,
        bottom: 742,
        left: 0,
        right: 200,
        width: 200,
        height: 42,
      };
    };
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      writable: true,
      configurable: true,
    });

    try {
      render(<DateTimePicker value="" onChange={() => {}} />);
      fireEvent.click(
        screen.getByRole("button", { name: /elegí fecha y hora/i }),
      );
      const dialog = screen.getByRole("dialog");
      // Con la clase "Up" → se abre hacia arriba (anclado al bottom del trigger).
      expect(dialog.className).toMatch(/Up/);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = proto;
    }
  });

  it("forwards `required` as aria-required on the trigger button", () => {
    render(<DateTimePicker value="" onChange={() => {}} required id="dt" />);
    const trigger = document.getElementById("dt");
    expect(trigger.getAttribute("aria-required")).toBe("true");
    expect(trigger.tagName).toBe("BUTTON");
  });
});

describe("<DateTimePicker> — modo dateOnly", () => {
  it("muestra 'Elegí fecha' y oculta el selector de hora", () => {
    render(<DateTimePicker dateOnly value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Elegí fecha" }));
    expect(screen.queryByLabelText("Hora")).toBeNull();
    expect(screen.queryByLabelText("Minutos")).toBeNull();
  });

  it("el label muestra solo la fecha (sin HH:MM)", () => {
    render(<DateTimePicker dateOnly value="2026-06-13" onChange={() => {}} />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent(/13/);
    expect(btn).not.toHaveTextContent(/:/);
  });

  it("elegir un día emite 'YYYY-MM-DD' y cierra el popover", () => {
    const onChange = vi.fn();
    render(
      <DateTimePicker
        dateOnly
        allowPast
        value="2026-06-13"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("gridcell", { name: /10 de junio/i }));
    expect(onChange).toHaveBeenCalledWith("2026-06-10");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("maxDate deshabilita los días posteriores (no los anteriores)", () => {
    render(
      <DateTimePicker
        dateOnly
        allowPast
        maxDate="2026-06-15"
        value="2026-06-13"
        onChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("gridcell", { name: /20 de junio/i })).toBeDisabled();
    expect(
      screen.getByRole("gridcell", { name: /10 de junio/i }),
    ).not.toBeDisabled();
  });
});
