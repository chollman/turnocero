import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import InfoTooltip from "./InfoTooltip";

describe("<InfoTooltip>", () => {
  it("renders the trigger with default aria-label", () => {
    render(<InfoTooltip>Contenido oculto</InfoTooltip>);
    const trigger = screen.getByRole("button", { name: /más información/i });
    expect(trigger).toBeInTheDocument();
    // Tooltip NO está visible por default.
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens on mouseEnter (desktop hover) and closes on mouseLeave", () => {
    render(<InfoTooltip>Texto de ayuda</InfoTooltip>);
    const trigger = screen.getByRole("button", { name: /más información/i });
    const wrapper = trigger.parentElement;

    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Texto de ayuda");

    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("toggles on click (mobile/touch path)", () => {
    render(<InfoTooltip>Ayuda</InfoTooltip>);
    const trigger = screen.getByRole("button", { name: /más información/i });

    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("un solo tap touch (mouseenter+focus+click emulados) abre y queda abierto", () => {
    // En touch, UN tap dispara esta secuencia; el click del mismo gesto no
    // debe togglear (antes cerraba y hacía falta un segundo tap).
    render(<InfoTooltip>Ayuda</InfoTooltip>);
    const trigger = screen.getByRole("button", { name: /más información/i });

    fireEvent.mouseEnter(trigger.parentElement);
    fireEvent.focus(trigger);
    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("opens on focus and closes on blur (keyboard navigation)", () => {
    render(<InfoTooltip>Ayuda</InfoTooltip>);
    const trigger = screen.getByRole("button", { name: /más información/i });

    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes when Escape is pressed", () => {
    render(<InfoTooltip>Ayuda</InfoTooltip>);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes when clicking outside the wrapper (caso opened-by-tap on mobile)", () => {
    render(
      <div>
        <InfoTooltip>Ayuda</InfoTooltip>
        <button data-testid="outside">Otro botón</button>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /más información/i }));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("renders rich content (HTML elements inside the tooltip)", () => {
    render(
      <InfoTooltip>
        Texto con <strong>negrita</strong> y <em>cursiva</em>.
      </InfoTooltip>,
    );
    fireEvent.click(screen.getByRole("button"));
    const tip = screen.getByRole("tooltip");
    expect(tip.querySelector("strong")).toHaveTextContent("negrita");
    expect(tip.querySelector("em")).toHaveTextContent("cursiva");
  });

  it("accepts a custom aria-label via prop", () => {
    render(<InfoTooltip label="Ayuda sobre el campo">x</InfoTooltip>);
    expect(
      screen.getByRole("button", { name: "Ayuda sobre el campo" }),
    ).toBeInTheDocument();
  });

  it('applies placement="bottom" class when requested', () => {
    render(<InfoTooltip placement="bottom">Abajo</InfoTooltip>);
    fireEvent.click(screen.getByRole("button"));
    const tip = screen.getByRole("tooltip");
    // El módulo CSS transforma los nombres pero contienen "Bottom".
    expect(tip.className).toMatch(/Bottom/);
  });

  it('default placement is "top"', () => {
    render(<InfoTooltip>Arriba</InfoTooltip>);
    fireEvent.click(screen.getByRole("button"));
    const tip = screen.getByRole("tooltip");
    expect(tip.className).toMatch(/Top/);
  });
});
