import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { STORAGE_KEYS } from "../../utils/storageKeys";

const h = vi.hoisted(() => ({
  user: { _id: "u1" },
  sectionEnabled: true,
  push: {},
  addToast: vi.fn(),
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: h.user }),
}));
vi.mock("../../context/SiteConfigContext", () => ({
  useSiteConfig: () => ({ isSectionEnabled: () => h.sectionEnabled }),
}));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: () => ({ addToast: h.addToast }),
}));
vi.mock("../../hooks/usePushNotifications", () => ({
  default: () => h.push,
}));

import PushPrompt from "./PushPrompt";

// Estado de push por defecto: soportado, permiso sin decidir, no suscripto.
function activatable(extra = {}) {
  return {
    isSupported: true,
    permission: "default",
    isSubscribed: false,
    requiresStandalone: false,
    busy: false,
    subscribe: vi.fn().mockResolvedValue(true),
    unsubscribe: vi.fn().mockResolvedValue(true),
    ...extra,
  };
}

// Simula que ya hubo N sesiones previas (la cuenta se bumpea al montar).
function seedSessions(n) {
  localStorage.setItem(
    STORAGE_KEYS.PUSH_PROMPT,
    JSON.stringify({ sessionCount: n, dismissedAt: null }),
  );
}

beforeEach(() => {
  localStorage.clear();
  h.user = { _id: "u1" };
  h.sectionEnabled = true;
  h.push = activatable();
  h.addToast = vi.fn();
});

describe("PushPrompt", () => {
  it("no aparece en la primera sesión", async () => {
    render(<PushPrompt />);
    // tras montar bumpea sessionCount a 1 → todavía no elegible
    await waitFor(() => {});
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("aparece a partir de la segunda sesión", async () => {
    seedSessions(1);
    render(<PushPrompt />);
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );
    expect(screen.getByText("Activar")).toBeInTheDocument();
  });

  it("'Activar' llama subscribe y oculta el prompt", async () => {
    seedSessions(1);
    render(<PushPrompt />);
    await waitFor(() => screen.getByRole("dialog"));

    fireEvent.click(screen.getByText("Activar"));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(h.push.subscribe).toHaveBeenCalled();
    expect(h.addToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    );
  });

  it("'Ahora no' persiste el dismiss y oculta", async () => {
    seedSessions(1);
    render(<PushPrompt />);
    await waitFor(() => screen.getByRole("dialog"));

    fireEvent.click(screen.getByText("Ahora no"));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.PUSH_PROMPT));
    expect(stored.dismissedAt).toBeTruthy();
  });

  it("no aparece si la sección push está apagada", async () => {
    seedSessions(1);
    h.sectionEnabled = false;
    render(<PushPrompt />);
    await waitFor(() => {});
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("no aparece si el permiso ya fue decidido (granted)", async () => {
    seedSessions(1);
    h.push = activatable({ permission: "granted" });
    render(<PushPrompt />);
    await waitFor(() => {});
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("no aparece para visitantes anónimos", async () => {
    seedSessions(1);
    h.user = null;
    render(<PushPrompt />);
    await waitFor(() => {});
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("en iOS-pestaña muestra el hint de instalar (sin botón Activar)", async () => {
    seedSessions(1);
    h.push = activatable({ isSupported: false, requiresStandalone: true });
    render(<PushPrompt />);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByText(/Instalá la app/i)).toBeInTheDocument();
    expect(screen.queryByText("Activar")).toBeNull();
    expect(screen.getByText("Entendido")).toBeInTheDocument();
  });
});
