import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RouterOnly } from "../../test/wrappers/AllProviders";
import EmptyState from "./EmptyState";
import { ArtMesa } from "./EmptyArt";

const renderES = (props) =>
  render(<EmptyState {...props} />, { wrapper: RouterOnly });

describe("<EmptyState>", () => {
  it("renders eyebrow, title (with <em>) and text", () => {
    renderES({
      eyebrow: "Ninguna mesa abierta",
      title: (
        <>
          La mesa está <em>servida.</em>
        </>
      ),
      text: "Todavía no hay mesas en tu zona.",
    });
    expect(screen.getByText("Ninguna mesa abierta")).toBeInTheDocument();
    expect(screen.getByText("servida.").tagName).toBe("EM");
    expect(
      screen.getByText("Todavía no hay mesas en tu zona."),
    ).toBeInTheDocument();
  });

  it("is announced to screen readers via role=status / aria-live", () => {
    renderES({ title: "x" });
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("renders the illustration inside an aria-hidden container", () => {
    const { container } = renderES({ art: <ArtMesa />, title: "x" });
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("shows ghost previews in the `first` variant", () => {
    renderES({
      variant: "first",
      ghost: <div data-testid="ghost-marker" />,
      title: "x",
    });
    expect(screen.getByTestId("ghost-marker")).toBeInTheDocument();
  });

  it("never renders ghosts in the `filtered` variant", () => {
    renderES({
      variant: "filtered",
      ghost: <div data-testid="ghost-marker" />,
      title: "x",
    });
    expect(screen.queryByTestId("ghost-marker")).not.toBeInTheDocument();
  });

  it("renders a primary CTA as a Link when `to` is given", () => {
    renderES({
      title: "x",
      primary: { label: "Crear la primera mesa", to: "/mesas/crear" },
    });
    const link = screen.getByRole("link", { name: /Crear la primera mesa/ });
    expect(link).toHaveAttribute("href", "/mesas/crear");
  });

  it("renders a primary CTA as a button and fires onClick", () => {
    const onClick = vi.fn();
    renderES({ title: "x", primary: { label: "Publicar", onClick } });
    fireEvent.click(screen.getByRole("button", { name: /Publicar/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("fires the secondary action", () => {
    const onClick = vi.fn();
    renderES({
      title: "x",
      secondary: { label: "Explorar otras zonas", onClick },
    });
    fireEvent.click(screen.getByRole("button", { name: /Explorar otras zonas/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders data-driven chips with counts and fires their handler", () => {
    const onClick = vi.fn();
    renderES({
      variant: "filtered",
      title: "x",
      chips: [{ label: "Mesas", count: 4, onClick }],
    });
    const chip = screen.getByRole("button", { name: /Mesas/ });
    expect(chip).toHaveTextContent("· 4");
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("omits the count when it is zero or missing", () => {
    renderES({
      variant: "filtered",
      title: "x",
      chips: [{ label: "Vacío", count: 0, onClick: () => {} }],
    });
    expect(screen.getByRole("button", { name: "Vacío" })).not.toHaveTextContent(
      "·",
    );
  });

  it("renders a hint node", () => {
    renderES({
      title: "x",
      hint: <span>las mesas suelen aparecer los jueves</span>,
    });
    expect(
      screen.getByText("las mesas suelen aparecer los jueves"),
    ).toBeInTheDocument();
  });

  it("supports a custom icon node on actions", () => {
    renderES({
      title: "x",
      primary: {
        label: "Custom",
        icon: <svg data-testid="custom-icon" />,
        onClick: () => {},
      },
    });
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });
});
