import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));
vi.mock("../../context/ChatContext", () => ({ useChat: vi.fn() }));
vi.mock("../../context/SiteConfigContext", () => ({ useSiteConfig: vi.fn() }));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import Navbar from "./Navbar";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { useChat } from "../../context/ChatContext";
import { useSiteConfig } from "../../context/SiteConfigContext";

function setup({
  logout = vi.fn(),
  unreadCount = 0,
  dmUnreadTotal = 0,
  sections = {},
} = {}) {
  useAuth.mockReturnValue({ logout });
  useNotifications.mockReturnValue({ unreadCount });
  useChat.mockReturnValue({ dmUnreadTotal });
  useSiteConfig.mockReturnValue({
    isSectionEnabled: (k) => sections[k] ?? true,
  });
  return render(
    <MemoryRouter>
      <Navbar />
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

  it('logout: first click shows confirm; "Sí" calls logout and navigates to /login', () => {
    const logout = vi.fn();
    setup({ logout });
    fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));
    // Now the confirm is showing
    expect(screen.getByText(/salir/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sí" }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith("/login");
  });

  it('logout: "No" cancels the confirm without logging out', () => {
    const logout = vi.fn();
    setup({ logout });
    fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(logout).not.toHaveBeenCalled();
    // Confirm is gone, logout button is back
    expect(screen.queryByText(/salir/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cerrar sesión/i }),
    ).toBeInTheDocument();
  });
});
