import { describe, it, expect, afterEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import { unsubscribeThisDevice } from "./pushDevice";

function installSW(sub) {
  const registration = {
    pushManager: { getSubscription: vi.fn().mockResolvedValue(sub) },
  };
  Object.defineProperty(navigator, "serviceWorker", {
    value: { ready: Promise.resolve(registration) },
    configurable: true,
  });
  return registration;
}

afterEach(() => {
  try {
    delete navigator.serviceWorker;
  } catch {
    /* noop */
  }
});

describe("unsubscribeThisDevice", () => {
  it("no rompe si no hay serviceWorker", async () => {
    await expect(unsubscribeThisDevice()).resolves.toBeUndefined();
  });

  it("no postea si no hay suscripción activa", async () => {
    let called = false;
    server.use(
      http.post("/api/push/unsubscribe", () => {
        called = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    installSW(null);
    await unsubscribeThisDevice();
    expect(called).toBe(false);
  });

  it("des-suscribe el push y postea el endpoint", async () => {
    let received = null;
    server.use(
      http.post("/api/push/unsubscribe", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );
    const unsub = vi.fn().mockResolvedValue(true);
    installSW({ endpoint: "https://push.example/1", unsubscribe: unsub });

    await unsubscribeThisDevice();

    expect(unsub).toHaveBeenCalledTimes(1);
    expect(received).toEqual({ endpoint: "https://push.example/1" });
  });

  it("no propaga errores (best-effort)", async () => {
    installSW({
      endpoint: "https://push.example/x",
      unsubscribe: vi.fn().mockRejectedValue(new Error("boom")),
    });
    await expect(unsubscribeThisDevice()).resolves.toBeUndefined();
  });
});
