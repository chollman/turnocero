import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Stub el chrome + el contenido para testear SOLO la lógica de gating de
// AppRoutes (qué chrome se muestra según user + la location MOSTRADA).
vi.mock("./components/layout/PageTransition", () => ({
  default: () => <div data-testid="content" />,
}));
vi.mock("./components/layout/GuestSidebar", () => ({
  default: () => <div data-testid="guest-sidebar" />,
}));
vi.mock("./components/layout/GuestNavbar", () => ({
  default: () => <div data-testid="guest-navbar" />,
}));
vi.mock("./components/layout/Sidebar", () => ({
  default: () => <div data-testid="sidebar" />,
}));
vi.mock("./components/layout/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

const useAuthMock = vi.fn();
vi.mock("./context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
  AuthProvider: ({ children }) => children,
}));
// AppRoutes lee viewingVersion del CommunityContext para el `key` de rutas.
vi.mock("./context/CommunityContext", () => ({
  useCommunity: () => ({ viewingVersion: 0 }),
  CommunityProvider: ({ children }) => children,
}));

import { AppRoutes } from "./App";

const transitionFor = (pathname) => ({
  displayLocation: { pathname },
  className: "",
  handleAnimationEnd: () => {},
});

function renderRoutes(transition, { initialEntry = "/" } = {}) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppRoutes transition={transition} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthMock.mockReset();
});

describe("AppRoutes — chrome gating follows the displayed location", () => {
  it("guest on an app page shows the guest sidebar + navbar", () => {
    useAuthMock.mockReturnValue({ user: null });
    renderRoutes(transitionFor("/"));
    expect(screen.getByTestId("guest-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("guest-navbar")).toBeInTheDocument();
  });

  it("hides the guest chrome when the DISPLAYED location is an auth page", () => {
    useAuthMock.mockReturnValue({ user: null });
    renderRoutes(transitionFor("/login"));
    expect(screen.queryByTestId("guest-sidebar")).toBeNull();
    expect(screen.queryByTestId("guest-navbar")).toBeNull();
  });

  it("authed user on an app page shows the authed sidebar + navbar", () => {
    useAuthMock.mockReturnValue({ user: { _id: "u1" } });
    renderRoutes(transitionFor("/mesas"));
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("navbar")).toBeInTheDocument();
  });

  it("hides the authed chrome on an auth page (reverse-direction sync after login)", () => {
    useAuthMock.mockReturnValue({ user: { _id: "u1" } });
    renderRoutes(transitionFor("/login"));
    expect(screen.queryByTestId("sidebar")).toBeNull();
    expect(screen.queryByTestId("navbar")).toBeNull();
  });

  it("follows the DISPLAYED location, not the live router location (the bug)", () => {
    useAuthMock.mockReturnValue({ user: null });
    // Live router is already at /login (URL changed), but the transition is
    // still DISPLAYING "/" mid-slideOut. The sidebar must stay until the
    // content actually swaps — this is exactly what was broken before.
    renderRoutes(transitionFor("/"), { initialEntry: "/login" });
    expect(screen.getByTestId("guest-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("guest-navbar")).toBeInTheDocument();
  });
});
