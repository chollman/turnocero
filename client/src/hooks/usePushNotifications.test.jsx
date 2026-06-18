import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import usePushNotifications from "./usePushNotifications";

const VAPID =
  "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8";

function Probe() {
  const p = usePushNotifications();
  return (
    <div>
      <span data-testid="supported">{String(p.isSupported)}</span>
      <span data-testid="permission">{p.permission}</span>
      <span data-testid="subscribed">{String(p.isSubscribed)}</span>
      <button onClick={() => p.subscribe()}>sub</button>
      <button onClick={() => p.unsubscribe()}>unsub</button>
    </div>
  );
}

function installSupport({ permission = "default", subscription = null } = {}) {
  const subscribeMock = vi.fn().mockResolvedValue({
    endpoint: "https://push.example/new",
    toJSON: () => ({
      endpoint: "https://push.example/new",
      keys: { p256dh: "p", auth: "a" },
    }),
  });
  const registration = {
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(subscription),
      subscribe: subscribeMock,
    },
  };
  Object.defineProperty(navigator, "serviceWorker", {
    value: { ready: Promise.resolve(registration) },
    configurable: true,
  });
  const NotificationMock = function Notification() {};
  NotificationMock.permission = permission;
  NotificationMock.requestPermission = vi.fn().mockResolvedValue("granted");
  window.Notification = NotificationMock;
  globalThis.Notification = NotificationMock;
  window.PushManager = function PushManager() {};
  globalThis.PushManager = window.PushManager;
  return { subscribeMock, registration, NotificationMock };
}

function clearSupport() {
  try {
    delete navigator.serviceWorker;
  } catch {
    /* noop */
  }
  delete window.Notification;
  delete globalThis.Notification;
  delete window.PushManager;
  delete globalThis.PushManager;
}

beforeEach(() => {
  clearSupport();
  vi.stubEnv("VITE_VAPID_PUBLIC_KEY", VAPID);
});

afterEach(() => {
  clearSupport();
  vi.unstubAllEnvs();
});

describe("usePushNotifications", () => {
  it("isSupported = false cuando faltan las APIs", () => {
    render(<Probe />);
    expect(screen.getByTestId("supported")).toHaveTextContent("false");
  });

  it("seedea isSubscribed=true si ya hay una suscripción", async () => {
    installSupport({ permission: "granted", subscription: { endpoint: "x" } });
    render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId("subscribed")).toHaveTextContent("true"),
    );
  });

  it("subscribe() POSTea el sub JSON y marca isSubscribed", async () => {
    let body = null;
    server.use(
      http.post("/api/push/subscribe", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ok: true }, { status: 201 });
      }),
    );
    const { subscribeMock } = installSupport({ permission: "default" });
    render(<Probe />);

    fireEvent.click(screen.getByText("sub"));

    await waitFor(() =>
      expect(screen.getByTestId("subscribed")).toHaveTextContent("true"),
    );
    expect(subscribeMock).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    expect(body).toEqual({
      endpoint: "https://push.example/new",
      keys: { p256dh: "p", auth: "a" },
    });
  });

  it("subscribe() corta sin POST si el permiso es denegado", async () => {
    let called = false;
    server.use(
      http.post("/api/push/subscribe", () => {
        called = true;
        return HttpResponse.json({ ok: true }, { status: 201 });
      }),
    );
    const { NotificationMock } = installSupport({ permission: "default" });
    NotificationMock.requestPermission = vi.fn().mockResolvedValue("denied");
    render(<Probe />);

    fireEvent.click(screen.getByText("sub"));

    await waitFor(() =>
      expect(screen.getByTestId("permission")).toHaveTextContent("denied"),
    );
    expect(called).toBe(false);
    expect(screen.getByTestId("subscribed")).toHaveTextContent("false");
  });

  it("unsubscribe() des-suscribe y POSTea el endpoint", async () => {
    let body = null;
    server.use(
      http.post("/api/push/unsubscribe", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );
    const unsub = vi.fn().mockResolvedValue(true);
    installSupport({
      permission: "granted",
      subscription: { endpoint: "https://push.example/old", unsubscribe: unsub },
    });
    render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId("subscribed")).toHaveTextContent("true"),
    );

    fireEvent.click(screen.getByText("unsub"));

    await waitFor(() =>
      expect(screen.getByTestId("subscribed")).toHaveTextContent("false"),
    );
    expect(unsub).toHaveBeenCalled();
    expect(body).toEqual({ endpoint: "https://push.example/old" });
  });
});
