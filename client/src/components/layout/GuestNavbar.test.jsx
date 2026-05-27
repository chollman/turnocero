import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GuestNavbar from "./GuestNavbar";
import { AllProviders } from "../../test/wrappers/AllProviders";

describe("<GuestNavbar>", () => {
  function renderNav(props = {}) {
    return render(<GuestNavbar {...props} />, { wrapper: AllProviders });
  }

  it("renders the TurnoCero brand mark", () => {
    renderNav();
    expect(screen.getByText("TurnoCero")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "TurnoCero" })).toHaveAttribute(
      "src",
      "/logo.svg",
    );
    expect(screen.getByText("BOARD GAME MEETUPS")).toBeInTheDocument();
  });

  it('logo links to "/"', () => {
    renderNav();
    const logoLink = screen.getByText("TurnoCero").closest("a");
    expect(logoLink).toHaveAttribute("href", "/");
  });

  it("renders Login and Registrate CTAs with correct hrefs", () => {
    renderNav();
    expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "Registrate" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("renders 'Abrir menú' when closed; clicking calls onToggleMenu", () => {
    const onToggleMenu = vi.fn();
    renderNav({ onToggleMenu, menuOpen: false });
    const btn = screen.getByRole("button", { name: /abrir menú/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn);
    expect(onToggleMenu).toHaveBeenCalledTimes(1);
  });

  it("labels button 'Cerrar menú' + aria-expanded=true when open", () => {
    renderNav({ onToggleMenu: vi.fn(), menuOpen: true });
    const btn = screen.getByRole("button", { name: /cerrar menú/i });
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  it("omits the toggle button when no onToggleMenu prop is given", () => {
    renderNav();
    expect(
      screen.queryByRole("button", { name: /abrir menú|cerrar menú/i }),
    ).not.toBeInTheDocument();
  });
});
