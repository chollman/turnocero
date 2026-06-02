import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AllProviders } from "../../test/wrappers/AllProviders";
import Privacidad from "./Privacidad";

function renderPage() {
  return render(<Privacidad />, { wrapper: AllProviders });
}

describe("<Privacidad>", () => {
  it("renders the heading and last-updated date", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /política de privacidad/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/última actualización:/i)).toBeInTheDocument();
  });

  it("links to the terms and conditions", () => {
    renderPage();
    const links = screen.getAllByRole("link", {
      name: /términos y condiciones/i,
    });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/terminos");
  });

  it("includes the key privacy sections", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /qué datos recopilamos/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /tus derechos/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /proveedores externos/i }),
    ).toBeInTheDocument();
  });
});
