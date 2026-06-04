import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ColaborarFab from "./ColaborarFab";

vi.mock("../../context/SiteConfigContext", () => ({
  useSiteConfig: vi.fn(),
}));
// ColaborarFab gates "colabora" via the combined useSectionEnabled hook, which
// also reads useCommunity (per-community override) + useAuth (admin bypass).
vi.mock("../../context/CommunityContext", () => ({ useCommunity: vi.fn() }));
vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

import { useSiteConfig } from "../../context/SiteConfigContext";
import { useCommunity } from "../../context/CommunityContext";
import { useAuth } from "../../context/AuthContext";

// Default the community override + auth so the global flag drives unless a test
// overrides it. Call before each render.
function primeContexts({ communitySections = {}, user = { _id: "u1" } } = {}) {
  useCommunity.mockReturnValue({
    isSectionEnabledInSkin: (k) => communitySections[k] ?? true,
  });
  useAuth.mockReturnValue({ user });
}

function renderAt(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<ColaborarFab />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("<ColaborarFab>", () => {
  beforeEach(() => primeContexts());

  it("renders a link to /colabora when the section is enabled", () => {
    useSiteConfig.mockReturnValue({
      isSectionEnabled: (s) => s === "colabora",
    });
    renderAt("/");
    const link = screen.getByRole("link", { name: /colaborar con turnocero/i });
    expect(link).toHaveAttribute("href", "/colabora");
    expect(link).toHaveTextContent(/bancanos/i);
  });

  it("renders nothing when the colabora section is disabled", () => {
    useSiteConfig.mockReturnValue({
      isSectionEnabled: () => false,
    });
    const { container } = renderAt("/");
    expect(container.textContent).toBe("");
  });

  // Regression: per-community override (tenant subdomain) hides the FAB even
  // when colabora is globally enabled.
  it("renders nothing when the community disabled colabora though globally on", () => {
    useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
    primeContexts({ communitySections: { colabora: false } });
    const { container } = renderAt("/");
    expect(container.textContent).toBe("");
  });

  it("hides on the /colabora route itself (no autopromotion)", () => {
    useSiteConfig.mockReturnValue({
      isSectionEnabled: () => true,
    });
    const { container } = renderAt("/colabora");
    expect(container.textContent).toBe("");
  });

  it("remains visible on other routes when enabled", () => {
    useSiteConfig.mockReturnValue({
      isSectionEnabled: () => true,
    });
    renderAt("/mesas/123");
    expect(
      screen.getByRole("link", { name: /colaborar con turnocero/i }),
    ).toBeInTheDocument();
  });
});
