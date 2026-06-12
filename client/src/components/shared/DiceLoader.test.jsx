import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DiceLoader from "./DiceLoader";

describe("<DiceLoader>", () => {
  it("renderiza el texto por defecto como status accesible, sin hint", () => {
    render(<DiceLoader />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/buscando/i);
    expect(screen.queryByText(/puede tardar/i)).toBeNull();
  });

  it("acepta texto y hint custom", () => {
    render(<DiceLoader text="Buscando en BGG" hint="esto demora" />);
    expect(screen.getByText(/buscando en bgg/i)).toBeInTheDocument();
    expect(screen.getByText("esto demora")).toBeInTheDocument();
  });

  it("con hint renderiza la aclaración", () => {
    render(<DiceLoader hint="puede tardar unos segundos" />);
    expect(screen.getByText(/puede tardar unos segundos/i)).toBeInTheDocument();
  });

  it("el dado es decorativo (aria-hidden)", () => {
    const { container } = render(<DiceLoader />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
