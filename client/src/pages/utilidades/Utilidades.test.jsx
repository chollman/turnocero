import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Utilidades from "./Utilidades";

function renderPage() {
  return render(
    <MemoryRouter>
      <Utilidades />
    </MemoryRouter>,
  );
}

describe("<Utilidades>", () => {
  it("renders the page title and subtitle", () => {
    renderPage();
    expect(screen.getByText("Utilidades")).toBeInTheDocument();
    expect(screen.getByText(/mini-apps para la mesa/i)).toBeInTheDocument();
  });

  it("renders three utility cards with correct destinations", () => {
    renderPage();
    expect(
      screen.getByRole("link", { name: /selector de dedos/i }),
    ).toHaveAttribute("href", "/utilidades/selector-de-dedos");
    expect(screen.getByRole("link", { name: /temporizador/i })).toHaveAttribute(
      "href",
      "/utilidades/temporizador",
    );
    expect(screen.getByRole("link", { name: /dado/i })).toHaveAttribute(
      "href",
      "/utilidades/dado",
    );
  });

  it("renders 6 coming-soon placeholder tiles", () => {
    renderPage();
    expect(screen.getAllByText("Próximamente").length).toBe(6);
  });
});
