import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AllProviders } from "../../test/wrappers/AllProviders";
import Terminos from "./Terminos";

function renderPage() {
  return render(<Terminos />, { wrapper: AllProviders });
}

describe("<Terminos>", () => {
  it("renders the heading and last-updated date", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /términos y condiciones de uso/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/última actualización:/i)).toBeInTheDocument();
  });

  it("links to the privacy policy", () => {
    renderPage();
    const links = screen.getAllByRole("link", {
      name: /política de privacidad/i,
    });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/privacidad");
  });

  it("includes the key legal sections", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /tu cuenta/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /uso aceptable/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /contenido que publicás/i }),
    ).toBeInTheDocument();
  });
});
