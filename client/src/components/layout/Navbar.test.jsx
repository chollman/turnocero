import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));
vi.mock("../../context/ChatContext", () => ({ useChat: vi.fn() }));
vi.mock("../../context/SiteConfigContext", () => ({ useSiteConfig: vi.fn() }));
// Navbar gates "dms" via the combined useSectionEnabled hook (global +
// per-community override), which also reads useAuth + useCommunity.
vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/CommunityContext", () => ({ useCommunity: vi.fn() }));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import Navbar from "./Navbar";
import { useNotifications } from "../../context/NotificationContext";
import { useChat } from "../../context/ChatContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useAuth } from "../../context/AuthContext";
import { useCommunity } from "../../context/CommunityContext";

function setup({
  unreadCount = 0,
  dmUnreadTotal = 0,
  sections = {},
  communitySections = {},
  menuOpen = false,
  onToggleMenu,
} = {}) {
  useNotifications.mockReturnValue({ unreadCount });
  useChat.mockReturnValue({ dmUnreadTotal });
  useAuth.mockReturnValue({ user: { _id: "u1" } });
  useSiteConfig.mockReturnValue({
    isSectionEnabled: (k) => sections[k] ?? true,
  });
  useCommunity.mockReturnValue({
    isSectionEnabledInSkin: (k) => communitySections[k] ?? true,
  });
  return render(
    <MemoryRouter>
      <Navbar menuOpen={menuOpen} onToggleMenu={onToggleMenu} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateMock.mockReset();
});

describe("<Navbar>", () => {
  it("renders the TurnoCero logo linking to /", () => {
    setup();
    const logoLink = screen.getByRole("link", { name: /turnocero/i });
    expect(logoLink).toHaveAttribute("href", "/");
  });

  it("renders the hamburger button labeled 'Abrir menú' when closed", () => {
    setup({ onToggleMenu: vi.fn(), menuOpen: false });
    const btn = screen.getByRole("button", { name: /abrir menú/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("labels the toggle button 'Cerrar menú' + aria-expanded=true when open", () => {
    setup({ onToggleMenu: vi.fn(), menuOpen: true });
    const btn = screen.getByRole("button", { name: /cerrar menú/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  it("clicking the toggle calls onToggleMenu", () => {
    const onToggleMenu = vi.fn();
    setup({ onToggleMenu, menuOpen: false });
    fireEvent.click(screen.getByRole("button", { name: /abrir menú/i }));
    expect(onToggleMenu).toHaveBeenCalledTimes(1);
  });

  it("hides the toggle button when no onToggleMenu prop is given", () => {
    setup();
    expect(
      screen.queryByRole("button", { name: /abrir menú|cerrar menú/i }),
    ).not.toBeInTheDocument();
  });

  it("shows DMs button when dms section is enabled", () => {
    setup({ sections: { dms: true } });
    expect(
      screen.getByRole("button", { name: /mensajes/i }),
    ).toBeInTheDocument();
  });

  it("hides DMs button when dms section is disabled", () => {
    setup({ sections: { dms: false } });
    expect(
      screen.queryByRole("button", { name: /mensajes/i }),
    ).not.toBeInTheDocument();
  });

  // Regression: per-community override (tenant subdomain) must hide DMs even
  // when globally enabled, via the combined useSectionEnabled gating.
  it("hides DMs when the community disabled it though globally enabled", () => {
    setup({ sections: { dms: true }, communitySections: { dms: false } });
    expect(
      screen.queryByRole("button", { name: /mensajes/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the DM unread badge", () => {
    setup({ dmUnreadTotal: 3 });
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it('caps DM badge at "9+" when > 9', () => {
    setup({ dmUnreadTotal: 12 });
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("shows the notification unread badge", () => {
    setup({ unreadCount: 5 });
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("clicking DMs navigates to /mensajes", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /mensajes/i }));
    expect(navigateMock).toHaveBeenCalledWith("/mensajes");
  });

  it("clicking the bell navigates to /notificaciones", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /notificaciones/i }));
    expect(navigateMock).toHaveBeenCalledWith("/notificaciones");
  });

  it("does not render a logout button (lives in the drawer menu now)", () => {
    setup({ onToggleMenu: vi.fn() });
    expect(
      screen.queryByRole("button", { name: /cerrar sesión/i }),
    ).not.toBeInTheDocument();
  });
});
