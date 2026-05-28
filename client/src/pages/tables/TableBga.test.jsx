import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import TableBga from "./TableBga";

describe("<TableBga>", () => {
  it("no renderiza nada cuando bgaUrl está vacío / null / undefined", () => {
    const { container: c1 } = render(<TableBga boardGame="Catan" bgaUrl="" />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(
      <TableBga boardGame="Catan" bgaUrl={null} />,
    );
    expect(c2.firstChild).toBeNull();

    const { container: c3 } = render(
      <TableBga boardGame="Catan" bgaUrl={undefined} />,
    );
    expect(c3.firstChild).toBeNull();
  });

  it("no renderiza nada cuando bgaUrl es whitespace", () => {
    const { container } = render(
      <TableBga boardGame="Catan" bgaUrl="   " />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza section + anchor con bgaUrl válido", () => {
    render(
      <TableBga
        boardGame="Catan"
        bgaUrl="https://boardgamearena.com/gamepanel?game=catan"
      />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      "https://boardgamearena.com/gamepanel?game=catan",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("interpola boardGame en el título", () => {
    render(
      <TableBga
        boardGame="Wingspan"
        bgaUrl="https://boardgamearena.com/x"
      />,
    );
    expect(screen.getByText("Wingspan")).toBeInTheDocument();
    expect(screen.getByText(/Board Game Arena/)).toBeInTheDocument();
  });

  it("muestra el logo de Board Game Arena y la flecha", () => {
    render(
      <TableBga boardGame="Catan" bgaUrl="https://boardgamearena.com/x" />,
    );
    const logo = screen.getByAltText("Board Game Arena");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/bga-logo.png");
    expect(screen.getByText("→")).toBeInTheDocument();
  });

  it("usa fallback 'este juego' si boardGame está vacío", () => {
    render(
      <TableBga boardGame="" bgaUrl="https://boardgamearena.com/x" />,
    );
    expect(screen.getByText("este juego")).toBeInTheDocument();
  });

  it("muestra el header de sección", () => {
    render(
      <TableBga
        boardGame="Catan"
        bgaUrl="https://boardgamearena.com/x"
      />,
    );
    expect(screen.getByText(/Probá el juego online/i)).toBeInTheDocument();
  });
});
