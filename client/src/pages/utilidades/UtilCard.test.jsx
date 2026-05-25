import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UtilCard from "./UtilCard";

function renderInRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("<UtilCard>", () => {
  it('renders icon, title, description, and links to "to"', () => {
    renderInRouter(
      <UtilCard
        icon="🎲"
        title="Dado"
        description="Tirá dados"
        to="/utilidades/dado"
      />,
    );
    expect(screen.getByText("🎲")).toBeInTheDocument();
    expect(screen.getByText("Dado")).toBeInTheDocument();
    expect(screen.getByText("Tirá dados")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dado/i })).toHaveAttribute(
      "href",
      "/utilidades/dado",
    );
  });

  it("omits description when not provided", () => {
    renderInRouter(<UtilCard icon="🎲" title="Dado" to="/x" />);
    expect(screen.queryByText(/tirá/i)).not.toBeInTheDocument();
  });

  it('renders a disabled "Próximamente" tile when comingSoon=true', () => {
    renderInRouter(<UtilCard comingSoon />);
    expect(screen.getByText("Próximamente")).toBeInTheDocument();
    expect(screen.getByText("🔒")).toBeInTheDocument();
    // No link in this state
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
