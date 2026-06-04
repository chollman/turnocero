import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";

// Modo tenant: el subdominio resuelve a "patagonia". Se mockea detectTenant
// (que CommunityContext lee UNA vez al cargar el módulo) en un archivo aparte
// para no contaminar los tests del modo normal.
vi.mock("../utils/tenant", () => ({ detectTenant: () => ({ slug: "patagonia" }) }));
vi.mock("./AuthContext", () => ({ useAuth: vi.fn() }));
import { useAuth } from "./AuthContext";
import { CommunityProvider, useCommunity } from "./CommunityContext";

const tenant = {
  _id: "ten1",
  name: "Patagonia",
  slug: "patagonia",
  isBase: false,
  subdomainEnabled: true,
  sections: { torneos: false },
  skin: {
    accents: { amber: "#e63946" },
    brandName: "Patagonia Juega",
    logoLight: { url: "http://x/p.png" },
  },
};

function Probe() {
  const c = useCommunity();
  return (
    <div>
      <span data-testid="loaded">{String(c.loaded)}</span>
      <span data-testid="isTenant">{String(c.isTenant)}</span>
      <span data-testid="tenantName">{c.tenant?.name || ""}</span>
      <span data-testid="viewing">{c.effectiveViewing.join(",")}</span>
      <span data-testid="brandName">{c.brand.name}</span>
      <span data-testid="torneosInSkin">
        {String(c.isSectionEnabledInSkin("torneos"))}
      </span>
    </div>
  );
}

const renderProvider = () =>
  render(
    <CommunityProvider>
      <Probe />
    </CommunityProvider>,
  );

beforeEach(() => vi.clearAllMocks());

afterEach(() => {
  document.documentElement.removeAttribute("data-community");
  const el = document.getElementById("community-skin");
  if (el) el.remove();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe("CommunityContext — tenant mode (subdomain)", () => {
  it("enters tenant mode for an anonymous visitor and forces skin + scope", async () => {
    useAuth.mockReturnValue({ user: null });
    server.use(
      http.get("/api/comunidades/patagonia", () => HttpResponse.json(tenant)),
    );
    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("isTenant").textContent).toBe("true"),
    );
    // Contenido acotado a la comunidad del subdominio.
    expect(screen.getByTestId("viewing").textContent).toBe("ten1");
    // Marca + sections salen del tenant (aunque el visitante no sea miembro).
    expect(screen.getByTestId("brandName").textContent).toBe("Patagonia Juega");
    expect(screen.getByTestId("torneosInSkin").textContent).toBe("false");
    // Skin inyectado al <html> aunque sea anónimo.
    await waitFor(() =>
      expect(document.documentElement.getAttribute("data-community")).toBe(
        "patagonia",
      ),
    );
    const styleEl = document.getElementById("community-skin");
    expect(styleEl).toBeTruthy();
    expect(styleEl.textContent).toContain("--amber: #e63946;");
  });

  it("does NOT enter tenant mode if the community lacks subdomainEnabled", async () => {
    useAuth.mockReturnValue({ user: null });
    server.use(
      http.get("/api/comunidades/patagonia", () =>
        HttpResponse.json({ ...tenant, subdomainEnabled: false }),
      ),
    );
    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("loaded").textContent).toBe("true"),
    );
    expect(screen.getByTestId("isTenant").textContent).toBe("false");
    expect(document.documentElement.getAttribute("data-community")).toBeNull();
  });
});
