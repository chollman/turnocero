import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const useAuthMock = vi.fn();
const useSiteConfigMock = vi.fn();
vi.mock("../../context/AuthContext", () => ({ useAuth: () => useAuthMock() }));
vi.mock("../../context/SiteConfigContext", () => ({
  useSiteConfig: () => useSiteConfigMock(),
}));

import PanelAdmin from "./PanelAdmin";

function renderPanel() {
  return render(
    <MemoryRouter>
      <PanelAdmin />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthMock.mockReturnValue({
    user: { _id: "admin", username: "admin", isAdmin: true },
    isActuallyAdmin: true,
    loading: false,
  });
  useSiteConfigMock.mockReturnValue({
    sections: {
      mesas: { enabled: true },
      compartidas: { enabled: true },
      noticias: { enabled: false },
      torneos: { enabled: true },
      eventos: { enabled: true },
      comunidad: { enabled: true },
      miFeed: { enabled: false },
      amigos: { enabled: true },
      dms: { enabled: true },
      bgwatch: { enabled: true },
      utilidades: { enabled: true },
    },
    loaded: true,
    updatedAt: "2026-05-01T10:00:00Z",
    updateConfig: vi.fn().mockResolvedValue({}),
  });
});

describe("<PanelAdmin>", () => {
  it("redirects to /login when no user is logged in", () => {
    useAuthMock.mockReturnValueOnce({
      user: null,
      isActuallyAdmin: false,
      loading: false,
    });
    const { container } = renderPanel();
    expect(container.querySelector("h1")).toBeNull();
  });

  it("redirects to / when user is not an admin", () => {
    useAuthMock.mockReturnValueOnce({
      user: { _id: "u1", isAdmin: false },
      isActuallyAdmin: false,
      loading: false,
    });
    const { container } = renderPanel();
    expect(container.querySelector("h1")).toBeNull();
  });

  it("renders nothing while auth is loading", () => {
    useAuthMock.mockReturnValueOnce({
      user: null,
      isActuallyAdmin: false,
      loading: true,
    });
    const { container } = renderPanel();
    expect(container.firstChild).toBeNull();
  });

  it("shows loading state when site config is not yet loaded", () => {
    useSiteConfigMock.mockReturnValueOnce({
      sections: null,
      loaded: false,
      updatedAt: null,
      updateConfig: vi.fn(),
    });
    renderPanel();
    expect(screen.getByText(/cargando configuración/i)).toBeInTheDocument();
  });

  it("renders all section groups: Contenido principal, Social, Integraciones", () => {
    renderPanel();
    expect(screen.getByText("Contenido principal")).toBeInTheDocument();
    expect(screen.getByText("Social")).toBeInTheDocument();
    expect(screen.getByText("Integraciones")).toBeInTheDocument();
  });

  it("renders all 11 section toggles with their labels", () => {
    renderPanel();
    expect(screen.getByText("Mesas")).toBeInTheDocument();
    expect(screen.getByText("Compartidas")).toBeInTheDocument();
    expect(screen.getByText("Noticias")).toBeInTheDocument();
    expect(screen.getByText("Torneos")).toBeInTheDocument();
    expect(screen.getByText("Eventos")).toBeInTheDocument();
    expect(screen.getByText("Comunidad")).toBeInTheDocument();
    expect(screen.getByText("Mi Feed")).toBeInTheDocument();
    expect(screen.getByText("Amigos")).toBeInTheDocument();
    expect(screen.getByText("Mensajes Directos")).toBeInTheDocument();
    expect(screen.getByText("BG Watch")).toBeInTheDocument();
    expect(screen.getByText("Utilidades")).toBeInTheDocument();
  });

  it("reflects the enabled state on each toggle via aria-checked", () => {
    renderPanel();
    expect(
      screen.getByRole("switch", { name: /desactivar mesas/i }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("switch", { name: /activar noticias/i }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("switch", { name: /activar mi feed/i }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("calls updateConfig({ key: { enabled: <next> } }) when a toggle is clicked", async () => {
    const updateConfig = vi.fn().mockResolvedValue({});
    useSiteConfigMock.mockReturnValueOnce({
      sections: { mesas: { enabled: true } },
      loaded: true,
      updatedAt: null,
      updateConfig,
    });
    renderPanel();
    fireEvent.click(screen.getByRole("switch", { name: /desactivar mesas/i }));
    await waitFor(() => {
      expect(updateConfig).toHaveBeenCalledWith({ mesas: { enabled: false } });
    });
  });

  it("shows error box when updateConfig rejects", async () => {
    const updateConfig = vi
      .fn()
      .mockRejectedValue({ response: { data: { message: "Forbidden" } } });
    useSiteConfigMock.mockReturnValueOnce({
      sections: { mesas: { enabled: true } },
      loaded: true,
      updatedAt: null,
      updateConfig,
    });
    renderPanel();
    fireEvent.click(screen.getByRole("switch", { name: /desactivar mesas/i }));
    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
  });
});
