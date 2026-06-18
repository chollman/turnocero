import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

const useNotificationsMock = vi.fn();
const pushHookMock = vi.fn();
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: () => useNotificationsMock(),
}));
vi.mock("../../hooks/usePushNotifications", () => ({
  default: () => pushHookMock(),
}));

import PushTestPanel from "./PushTestPanel";

const addToast = vi.fn();

beforeEach(() => {
  addToast.mockClear();
  useNotificationsMock.mockReturnValue({ addToast });
  pushHookMock.mockReturnValue({
    isSupported: true,
    isSubscribed: true,
    permission: "granted",
    requiresStandalone: false,
    subscribe: vi.fn(),
    busy: false,
  });
});

const clickSend = () =>
  fireEvent.click(
    screen.getByRole("button", { name: /enviar push de prueba/i }),
  );

describe("<PushTestPanel>", () => {
  it("renderiza el título y el botón de envío", () => {
    render(<PushTestPanel />);
    expect(screen.getByText("Probar notificaciones push")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /enviar push de prueba/i }),
    ).toBeInTheDocument();
  });

  it("POSTea a /api/push/test y muestra un toast de éxito con el conteo", async () => {
    let hit = false;
    server.use(
      http.post("/api/push/test", () => {
        hit = true;
        return HttpResponse.json({ ok: true, sent: 2, pruned: 0 });
      }),
    );
    render(<PushTestPanel />);
    clickSend();

    await waitFor(() => expect(hit).toBe(true));
    await waitFor(() =>
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "success" }),
      ),
    );
    expect(addToast.mock.calls[0][0].message).toMatch(/2 dispositivos/i);
  });

  it("avisa cuando no hay dispositivos suscriptos (sent: 0)", async () => {
    server.use(
      http.post("/api/push/test", () =>
        HttpResponse.json({ ok: true, sent: 0, pruned: 0 }),
      ),
    );
    render(<PushTestPanel />);
    clickSend();

    await waitFor(() =>
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Sin dispositivos suscriptos",
        }),
      ),
    );
  });

  it("muestra un toast de error cuando el request falla", async () => {
    server.use(
      http.post("/api/push/test", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    render(<PushTestPanel />);
    clickSend();

    await waitFor(() =>
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error", title: "Error" }),
      ),
    );
  });

  it("ofrece activar acá cuando este dispositivo no está suscripto", () => {
    pushHookMock.mockReturnValue({
      isSupported: true,
      isSubscribed: false,
      permission: "default",
      requiresStandalone: false,
      subscribe: vi.fn(),
      busy: false,
    });
    render(<PushTestPanel />);
    expect(
      screen.getByRole("button", { name: /activar acá/i }),
    ).toBeInTheDocument();
  });

  it("no ofrece activar si el dispositivo ya está suscripto", () => {
    render(<PushTestPanel />);
    expect(
      screen.queryByRole("button", { name: /activar acá/i }),
    ).not.toBeInTheDocument();
  });
});
