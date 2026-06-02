import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";

vi.mock("./AuthContext", () => ({ useAuth: vi.fn() }));
import { useAuth } from "./AuthContext";
import { CommunityProvider, useCommunity } from "./CommunityContext";

const base = {
  _id: "base1",
  name: "TurnoCero",
  slug: "turnocero",
  isBase: true,
  sections: {},
};
const beta = {
  _id: "beta1",
  name: "Beta",
  slug: "beta",
  isBase: false,
  sections: { torneos: false },
};

function Probe() {
  const c = useCommunity();
  return (
    <div>
      <span data-testid="loaded">{String(c.loaded)}</span>
      <span data-testid="memberships">{c.memberships.length}</span>
      <span data-testid="viewing">{c.effectiveViewing.join(",")}</span>
      <span data-testid="skin">{c.skinCommunity?.slug || ""}</span>
      <span data-testid="torneosInSkin">
        {String(c.isSectionEnabledInSkin("torneos"))}
      </span>
      <span data-testid="mesasInSkin">
        {String(c.isSectionEnabledInSkin("mesas"))}
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
  // El motor de skin muta el documento global de jsdom — limpiar entre tests.
  document.documentElement.removeAttribute("data-community");
  const el = document.getElementById("community-skin");
  if (el) el.remove();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe("CommunityContext", () => {
  it("anonymous → empty memberships, loaded true, no skin restriction", async () => {
    useAuth.mockReturnValue({ user: null });
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("loaded").textContent).toBe("true"),
    );
    expect(screen.getByTestId("memberships").textContent).toBe("0");
    expect(screen.getByTestId("torneosInSkin").textContent).toBe("true");
  });

  it("loads memberships, resolves the skin community, and applies its section override", async () => {
    useAuth.mockReturnValue({ user: { _id: "u1" } });
    server.use(
      http.get("/api/comunidades/mias", () =>
        HttpResponse.json({
          memberships: [
            { community: base, role: "member" },
            { community: beta, role: "subadmin" },
          ],
          viewing: [],
          skin: "beta1",
        }),
      ),
    );
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("memberships").textContent).toBe("2"),
    );
    // viewing vacío = todas las memberships
    expect(screen.getByTestId("viewing").textContent).toBe("base1,beta1");
    expect(screen.getByTestId("skin").textContent).toBe("beta");
    // Beta apaga torneos en su skin → gating por comunidad lo refleja
    expect(screen.getByTestId("torneosInSkin").textContent).toBe("false");
    expect(screen.getByTestId("mesasInSkin").textContent).toBe("true");
  });

  it("intersects a curated viewing subset with the live memberships", async () => {
    useAuth.mockReturnValue({ user: { _id: "u1" } });
    server.use(
      http.get("/api/comunidades/mias", () =>
        HttpResponse.json({
          memberships: [{ community: beta, role: "member" }],
          viewing: ["beta1", "ghost"],
          skin: "beta1",
        }),
      ),
    );
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("loaded").textContent).toBe("true"),
    );
    expect(screen.getByTestId("viewing").textContent).toBe("beta1");
  });

  it("injects the skin <style> + data-community for a non-base skin community", async () => {
    useAuth.mockReturnValue({ user: { _id: "u1" } });
    const skinned = {
      _id: "sk1",
      name: "Skinned",
      slug: "skinned",
      isBase: false,
      sections: {},
      skin: { accents: { amber: "#e63946" } },
    };
    server.use(
      http.get("/api/comunidades/mias", () =>
        HttpResponse.json({
          memberships: [{ community: skinned, role: "member" }],
          viewing: [],
          skin: "sk1",
        }),
      ),
    );
    renderProvider();
    await waitFor(() =>
      expect(document.documentElement.getAttribute("data-community")).toBe(
        "skinned",
      ),
    );
    const styleEl = document.getElementById("community-skin");
    expect(styleEl).toBeTruthy();
    expect(styleEl.textContent).toContain("--amber: #e63946;");
  });

  it("falls back to base-only mode when /mias errors (section off)", async () => {
    useAuth.mockReturnValue({ user: { _id: "u1" } });
    server.use(
      http.get("/api/comunidades/mias", () =>
        HttpResponse.json({ message: "off" }, { status: 403 }),
      ),
    );
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("loaded").textContent).toBe("true"),
    );
    expect(screen.getByTestId("memberships").textContent).toBe("0");
  });
});
