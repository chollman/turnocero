import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GuestSidebar from "./GuestSidebar";

vi.mock("../../context/SiteConfigContext", () => ({
  useSiteConfig: vi.fn(),
}));
vi.mock("../../context/CommunityContext", () => ({
  useCommunity: vi.fn(),
}));
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useCommunity } from "../../context/CommunityContext";

const DEFAULT_BRAND = {
  name: "TurnoCero",
  tagline: "",
  logoLight: "",
  logoDark: "",
};

function renderAt(
  pathname,
  sectionEnabledMap = {},
  props = {},
  community = {},
) {
  useSiteConfig.mockReturnValue({
    isSectionEnabled: (k) => sectionEnabledMap[k] ?? true,
  });
  useCommunity.mockReturnValue({
    isTenant: false,
    brand: DEFAULT_BRAND,
    ...community,
  });
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <GuestSidebar {...props} />
    </MemoryRouter>,
  );
}

describe("<GuestSidebar>", () => {
  it("renders the brand logo + login/register CTAs", () => {
    renderAt("/");
    expect(screen.getByText("TurnoCero")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^login$/i })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: /registrate/i })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("in tenant mode shows the community name + logo instead of TurnoCero", () => {
    renderAt(
      "/",
      {},
      {},
      {
        isTenant: true,
        brand: {
          name: "El Clu",
          tagline: "Comunidad de Telegram",
          logoLight: "https://cdn/elclu-light.png",
          logoDark: "https://cdn/elclu-dark.png",
        },
      },
    );
    expect(screen.getByText("El Clu")).toBeInTheDocument();
    expect(screen.queryByText("TurnoCero")).not.toBeInTheDocument();
    expect(screen.getByText("Comunidad de Telegram")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /el clu/i })).toBeInTheDocument();
  });

  it("shows Noticias + Compartidas when both sections are enabled", () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: /noticias/i })).toHaveAttribute(
      "href",
      "/noticias",
    );
    expect(screen.getByRole("link", { name: /compartidas/i })).toHaveAttribute(
      "href",
      "/compartidas",
    );
  });

  it("hides Noticias when the section is disabled", () => {
    renderAt("/", { noticias: false });
    expect(
      screen.queryByRole("link", { name: /noticias/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /compartidas/i }),
    ).toBeInTheDocument();
  });

  it("marks the current path as active", () => {
    renderAt("/noticias");
    const noticiasLink = screen.getByRole("link", { name: /noticias/i });
    expect(noticiasLink.className).toMatch(/active/i);
    const compartidasLink = screen.getByRole("link", { name: /compartidas/i });
    expect(compartidasLink.className).not.toMatch(/active/i);
  });

  describe("drawer mode (mobile)", () => {
    it("does not render an in-drawer close button — GuestNavbar's toggle handles closing", () => {
      renderAt("/", {}, { onClose: vi.fn(), open: true });
      expect(
        screen.queryByRole("button", { name: /cerrar menú/i }),
      ).not.toBeInTheDocument();
    });

    it("Escape calls onClose when open", () => {
      const onClose = vi.fn();
      renderAt("/", {}, { onClose, open: true });
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
