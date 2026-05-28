import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));
vi.mock("../../context/SiteConfigContext", () => ({ useSiteConfig: vi.fn() }));

import Sidebar from "./Sidebar";

import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { useSiteConfig } from "../../context/SiteConfigContext";

function setup({
  user = { _id: "u1", username: "cha", bggUsername: "" },
  isActuallyAdmin = false,
  logout = vi.fn(),
  unreadCount = 0,
  adminChatUnread = 0,
  sections = {},
  pathname = "/",
  open,
  onClose,
} = {}) {
  useAuth.mockReturnValue({ user, isActuallyAdmin, logout });
  useNotifications.mockReturnValue({ unreadCount, adminChatUnread });
  useSiteConfig.mockReturnValue({
    isSectionEnabled: (k) => sections[k] ?? true,
  });
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Sidebar open={open} onClose={onClose} />
    </MemoryRouter>,
  );
}

describe("<Sidebar>", () => {
  it("renders the TurnoCero brand + user chip", () => {
    setup();
    expect(screen.getByText("TurnoCero")).toBeInTheDocument();
    expect(screen.getByText("cha")).toBeInTheDocument();
  });

  it("shows the notifications bell with unread badge when count > 0", () => {
    setup({ unreadCount: 5 });
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it('caps the bell badge at "9+" when above 9', () => {
    setup({ unreadCount: 42 });
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("hides admin-only items from non-admins", () => {
    setup({ isActuallyAdmin: false });
    expect(
      screen.queryByRole("link", { name: /panel admin/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /base de datos/i }),
    ).not.toBeInTheDocument();
  });

  it("shows admin-only items to actual admins", () => {
    setup({ isActuallyAdmin: true });
    expect(
      screen.getByRole("link", { name: /panel admin/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /base de datos/i }),
    ).toBeInTheDocument();
  });

  it("hides sections whose SiteConfig flag is false", () => {
    setup({ sections: { eventos: false } });
    expect(
      screen.queryByRole("link", { name: /^eventos$/i }),
    ).not.toBeInTheDocument();
  });

  it('shows "Activá BG Watch" CTA for users without bggUsername (when bgwatch enabled)', () => {
    setup({
      user: { _id: "u1", username: "cha" },
      sections: { bgwatch: true },
    });
    expect(
      screen.getByRole("link", { name: /activ[aá] bg watch/i }),
    ).toBeInTheDocument();
  });

  it("shows BG Watch link when user has bggUsername", () => {
    setup({
      user: { _id: "u1", username: "cha", bggUsername: "CarcaFan" },
      sections: { bgwatch: true },
    });
    expect(screen.getByRole("link", { name: /bg watch/i })).toHaveAttribute(
      "href",
      "/bg-watch/CarcaFan",
    );
  });

  it("marks the active nav item based on pathname", () => {
    setup({ pathname: "/eventos" });
    const eventos = screen.getByRole("link", { name: /^eventos$/i });
    expect(eventos.className).toMatch(/active/i);
  });

  it("shows the adminChat badge when admin has unread admin chat messages", () => {
    setup({ isActuallyAdmin: true, adminChatUnread: 3 });
    // The badge text "3" should be in DOM (next to the chat-admin nav item).
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });

  it("clicking the notifications bell navigates to /notificaciones", () => {
    navigateMock.mockReset();
    setup();
    fireEvent.click(screen.getByLabelText("Notificaciones"));
    expect(navigateMock).toHaveBeenCalledWith("/notificaciones");
  });

  it('logout flow: shows confirmation, "Sí" calls logout + navigates to /login', () => {
    const logout = vi.fn();
    navigateMock.mockReset();
    setup({ logout });
    fireEvent.click(screen.getByTitle("Cerrar sesión"));
    expect(screen.getByText("¿Cerrar sesión?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sí" }));
    expect(logout).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/login");
  });

  it('logout flow: clicking "No" cancels the confirmation', () => {
    const logout = vi.fn();
    setup({ logout });
    fireEvent.click(screen.getByTitle("Cerrar sesión"));
    expect(screen.getByText("¿Cerrar sesión?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(screen.queryByText("¿Cerrar sesión?")).not.toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });

  describe("drawer mode (mobile)", () => {
    it("does not render an in-drawer close button — Navbar's morphing toggle handles closing", () => {
      setup({ onClose: vi.fn(), open: true });
      expect(
        screen.queryByRole("button", { name: /cerrar menú/i }),
      ).not.toBeInTheDocument();
    });

    it("Escape key calls onClose when open", () => {
      const onClose = vi.fn();
      setup({ onClose, open: true });
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("Escape key is ignored when drawer is closed", () => {
      const onClose = vi.fn();
      setup({ onClose, open: false });
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).not.toHaveBeenCalled();
    });

    it("clicking a nav item calls onClose even when the link points to the current pathname", () => {
      // Regression: useEffect([pathname]) doesn't fire when the link's
      // destination is the page you're already on, so onClose must run
      // from the Link's onClick instead.
      const onClose = vi.fn();
      setup({ onClose, open: true, pathname: "/mesas" });
      const mesasLink = screen.getByRole("link", { name: /^mesas$/i });
      fireEvent.click(mesasLink);
      expect(onClose).toHaveBeenCalled();
    });
  });
});
