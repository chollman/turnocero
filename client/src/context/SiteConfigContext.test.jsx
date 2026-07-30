import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";

const useAuthMock = vi.fn();
vi.mock("./AuthContext", () => ({ useAuth: () => useAuthMock() }));

import { SiteConfigProvider, useSiteConfig } from "./SiteConfigContext";

// Fresh QueryClient por render, sin retries (evita backoff en mocks de error).
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function Probe() {
  const {
    sections,
    loaded,
    backendDown,
    retryConnection,
    isSectionEnabled,
    updateConfig,
  } = useSiteConfig();
  return (
    <div>
      <span data-testid="loaded">{String(loaded)}</span>
      <span data-testid="backend-down">{String(backendDown)}</span>
      <span data-testid="mesas">{String(sections?.mesas?.enabled)}</span>
      <span data-testid="compartidas-enabled">
        {String(isSectionEnabled("compartidas"))}
      </span>
      <span data-testid="mesas-enabled">
        {String(isSectionEnabled("mesas"))}
      </span>
      <button onClick={() => updateConfig({ mesas: { enabled: true } })}>
        enable-mesas
      </button>
      <button onClick={retryConnection}>retry</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <SiteConfigProvider>
        <Probe />
      </SiteConfigProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useAuthMock.mockReturnValue({ user: null });
  server.use(
    http.get("/api/site-config", () =>
      HttpResponse.json({
        sections: {
          mesas: { enabled: true },
          compartidas: { enabled: false },
          noticias: { enabled: true },
          torneos: { enabled: true },
          eventos: { enabled: true },
          comunidad: { enabled: true },
          miFeed: { enabled: true },
          amigos: { enabled: true },
          dms: { enabled: true },
          bgwatch: { enabled: true },
          utilidades: { enabled: true },
        },
        updatedAt: "2026-05-01T10:00:00Z",
        updatedBy: { _id: "admin", username: "admin" },
      }),
    ),
  );
});

describe("SiteConfigContext", () => {
  it("starts with loaded=false until the API resolves", () => {
    renderProvider();
    expect(screen.getByTestId("loaded").textContent).toBe("false");
  });

  it("loads sections from /api/site-config and sets loaded=true", async () => {
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("loaded").textContent).toBe("true");
    });
    expect(screen.getByTestId("mesas").textContent).toBe("true");
  });

  it("isSectionEnabled returns false when section is disabled and user is NOT admin", async () => {
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("loaded").textContent).toBe("true");
    });
    expect(screen.getByTestId("compartidas-enabled").textContent).toBe("false");
  });

  it("isSectionEnabled returns true for admins even when section is disabled", async () => {
    useAuthMock.mockReturnValue({ user: { isAdmin: true } });
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("loaded").textContent).toBe("true");
    });
    // Compartidas is disabled in our handler, but admin should still see true
    expect(screen.getByTestId("compartidas-enabled").textContent).toBe("true");
  });

  it("falls back to defaults when the API fails", async () => {
    server.use(
      http.get("/api/site-config", () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("loaded").textContent).toBe("true");
    });
    // Default for mesas is `false`
    expect(screen.getByTestId("mesas").textContent).toBe("false");
  });

  it("flags backendDown when the boot request returns a 5xx", async () => {
    server.use(
      http.get("/api/site-config", () =>
        HttpResponse.json({}, { status: 503 }),
      ),
    );
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("loaded").textContent).toBe("true");
    });
    expect(screen.getByTestId("backend-down").textContent).toBe("true");
  });

  it("flags backendDown when the boot request fails with a network error", async () => {
    server.use(http.get("/api/site-config", () => HttpResponse.error()));
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("loaded").textContent).toBe("true");
    });
    expect(screen.getByTestId("backend-down").textContent).toBe("true");
  });

  it("does NOT flag backendDown on a 4xx (server is alive)", async () => {
    server.use(
      http.get("/api/site-config", () =>
        HttpResponse.json({ message: "nope" }, { status: 404 }),
      ),
    );
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("loaded").textContent).toBe("true");
    });
    expect(screen.getByTestId("backend-down").textContent).toBe("false");
  });

  it("retryConnection clears backendDown when the backend recovers", async () => {
    let calls = 0;
    server.use(
      http.get("/api/site-config", () => {
        calls += 1;
        if (calls === 1) return HttpResponse.error();
        return HttpResponse.json({
          sections: { mesas: { enabled: true } },
        });
      }),
    );
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("backend-down").textContent).toBe("true");
    });
    await act(async () => {
      screen.getByText("retry").click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("backend-down").textContent).toBe("false");
    });
    expect(screen.getByTestId("mesas").textContent).toBe("true");
  });

  it("updateConfig PATCHes /api/site-config and applies the response", async () => {
    let patched = false;
    server.use(
      http.patch("/api/site-config", async ({ request }) => {
        patched = true;
        const body = await request.json();
        return HttpResponse.json({
          sections: { ...body.sections, mesas: { enabled: true } },
          updatedAt: "2026-05-02T10:00:00Z",
          updatedBy: { _id: "admin" },
        });
      }),
    );
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("loaded").textContent).toBe("true");
    });
    await act(async () => {
      screen.getByText("enable-mesas").click();
    });
    expect(patched).toBe(true);
  });

  it("useSiteConfig throws when used outside SiteConfigProvider", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      /useSiteConfig must be used within SiteConfigProvider/,
    );
    errorSpy.mockRestore();
  });
});
