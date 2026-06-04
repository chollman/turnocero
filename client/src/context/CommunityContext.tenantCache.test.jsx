import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// CACHED_TENANT_BRAND se lee UNA vez al cargar el módulo CommunityContext, desde
// el skin de localStorage. vi.hoisted corre ANTES de los imports, así sembramos
// el cache para verificar el fallback síncrono del nombre de marca (anti-FOUC
// del SplashScreen) mientras el GET del tenant todavía no resolvió.
vi.hoisted(() => {
  try {
    globalThis.localStorage.setItem(
      "turnocero_skin",
      JSON.stringify({
        slug: "patagonia",
        css: "",
        brandName: "Patagonia Juega",
      }),
    );
  } catch {
    /* ignore */
  }
});

vi.mock("../utils/tenant", () => ({
  detectTenant: () => ({ slug: "patagonia" }),
}));
vi.mock("./AuthContext", () => ({ useAuth: vi.fn() }));
import { useAuth } from "./AuthContext";
import { CommunityProvider, useCommunity } from "./CommunityContext";

function Probe() {
  const c = useCommunity();
  return <span data-testid="brandName">{c.brand.name}</span>;
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: null });
});

describe("CommunityContext — cached tenant brand name (anti-FOUC)", () => {
  it("uses the cached community brand name before the tenant fetch resolves", () => {
    render(
      <CommunityProvider>
        <Probe />
      </CommunityProvider>,
    );
    // Render síncrono inicial: el tenant todavía no cargó (isTenant=false), pero
    // el nombre cacheado evita mostrar "TurnoCero".
    expect(screen.getByTestId("brandName").textContent).toBe("Patagonia Juega");
  });
});
