import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GuestNavbar from "./GuestNavbar";
import { AllProviders } from "../../test/wrappers/AllProviders";
import i18n from "../../i18n";

vi.mock("../../context/CommunityContext", () => ({
  useCommunity: vi.fn(),
}));
import { useCommunity } from "../../context/CommunityContext";

const DEFAULT_BRAND = {
  name: "TurnoCero",
  tagline: "",
  logoLight: "",
  logoDark: "",
};

describe("<GuestNavbar>", () => {
  beforeEach(() => {
    useCommunity.mockReturnValue({ isTenant: false, brand: DEFAULT_BRAND });
  });

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

  it("in tenant mode renders the community name + logo instead of TurnoCero", () => {
    useCommunity.mockReturnValue({
      isTenant: true,
      brand: {
        name: "El Clu",
        tagline: "Comunidad de Telegram",
        logoLight: "https://cdn/elclu-light.png",
        logoDark: "https://cdn/elclu-dark.png",
      },
    });
    renderNav();
    expect(screen.getByText("El Clu")).toBeInTheDocument();
    expect(screen.queryByText("TurnoCero")).not.toBeInTheDocument();
    expect(screen.getByText("Comunidad de Telegram")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "El Clu" })).toBeInTheDocument();
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

  describe("English locale", () => {
    afterEach(() => {
      i18n.changeLanguage("es");
    });

    it("renders English labels when language is 'en'", () => {
      i18n.changeLanguage("en");
      renderNav({ onToggleMenu: vi.fn(), menuOpen: false });
      expect(
        screen.getByRole("link", { name: "Register" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /open menu/i }),
      ).toBeInTheDocument();
    });
  });
});
