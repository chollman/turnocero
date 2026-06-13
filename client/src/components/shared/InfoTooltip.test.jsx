import { describe, it, expect, vi } from "vitest";
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

  it("clampea el left del tooltip al viewport (mobile, sin desbordar a la derecha)", () => {
    const realClientWidth = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "clientWidth",
    );
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      get: () => 375,
    });
    // wrapper cerca del borde derecho (centro ~360); tooltip de 280px.
    const rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockReturnValue({
        left: 348,
        right: 372,
        top: 0,
        bottom: 24,
        width: 24,
        height: 24,
      });
    const widthSpy = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockReturnValue(280);

    render(<InfoTooltip>Texto largo del tooltip</InfoTooltip>);
    fireEvent.click(screen.getByRole("button"));
    const tip = screen.getByRole("tooltip");

    // viewport-left deseado = clamp(360 - 140, 16, 375 - 16 - 280=79) = 79.
    // left relativo al wrapper (wrapRect.left=348) = 79 - 348 = -269px.
    expect(tip.style.left).toBe("-269px");
    // y queda visible (medido, no oculto).
    expect(tip.style.visibility).not.toBe("hidden");

    rectSpy.mockRestore();
    widthSpy.mockRestore();
    if (realClientWidth)
      Object.defineProperty(
        document.documentElement,
        "clientWidth",
        realClientWidth,
      );
  });
});
