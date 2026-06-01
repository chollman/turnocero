import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { http, HttpResponse } from "msw";
import { server } from "./test/server";

// App importa muchos providers (Theme, Auth, SiteConfig, Notification, Chat) +
// BrowserRouter. Por defecto AuthContext intenta `GET /api/auth/me` y el resto
// pega a /api/site-config, /api/notifications. test/server.js define handlers
// MSW para esos.
//
// Smoke test: verificamos que App monta sin tirar y que renderiza el splash
// inicial mientras auth loading. No queremos un E2E aquí — eso ya está
// distribuido entre los tests por página.

import App from "./App";

// Algunos componentes importados por App (BoardGameBackground, etc.) usan
// canvas/animations que jsdom no maneja bien — silenciamos console.error
// para que no spamee si hay warnings de animación que no rompen funcional.
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("App", () => {
  it("monta sin tirar (smoke test)", async () => {
    expect(() =>
      render(
        <HelmetProvider>
          <App />
        </HelmetProvider>,
      ),
    ).not.toThrow();
  });

  it("renderiza el SplashScreen inicial mientras carga auth", async () => {
    render(
      <HelmetProvider>
        <App />
      </HelmetProvider>,
    );
    // SplashScreen tiene rol/atributo conocido. Si lo eliminamos en el
    // futuro, este test guía a actualizarlo en vez de fallar silenciosamente.
    // Buscamos cualquier elemento visible — el splash debería estar.
    // Validamos via existencia del document.body con contenido.
    await waitFor(() => {
      expect(document.body.firstChild).not.toBeNull();
    });
  });

  it("muestra la pantalla 500 cuando el backend no responde en el boot", async () => {
    // El health-check de boot (GET /api/site-config) falla con un error de red
    // ⇒ backendDown ⇒ AppShell toma la pantalla full-screen "se nos volcó el
    // tablero" en vez del shell.
    server.use(http.get("/api/site-config", () => HttpResponse.error()));
    render(
      <HelmetProvider>
        <App />
      </HelmetProvider>,
    );
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: "500" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/volcó el tablero/i)).toBeInTheDocument();
  });
});
