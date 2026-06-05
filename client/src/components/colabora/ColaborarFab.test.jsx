import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
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

function renderAt(path = "/", props = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<ColaborarFab {...props} />} />
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

  // Auto-hide: the FAB slides back out (becomes non-interactive) ~10s after the
  // entrance finishes (11.5s after mount).
  describe("auto-hide after the entrance", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("marks the FAB hidden once the timeout elapses", () => {
      useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
      renderAt("/");
      const link = screen.getByRole("link", {
        name: /colaborar con turnocero/i,
      });
      expect(link).not.toHaveAttribute("aria-hidden");

      act(() => vi.advanceTimersByTime(11500));

      expect(link).toHaveAttribute("aria-hidden", "true");
      expect(link).toHaveAttribute("tabindex", "-1");
    });

    it("stays visible before the timeout fires", () => {
      useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
      renderAt("/");
      act(() => vi.advanceTimersByTime(11000));
      expect(
        screen.getByRole("link", { name: /colaborar con turnocero/i }),
      ).not.toHaveAttribute("aria-hidden");
    });

    it("keeps reporting visible until the slide-out settles, then drops", () => {
      useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
      const onVisibilityChange = vi.fn();
      renderAt("/", { onVisibilityChange });
      // Reports visible once mounted.
      expect(onVisibilityChange).toHaveBeenLastCalledWith(true);

      // FAB begins sliding out at 11.5s, but stays "visible" to the toggle so it
      // doesn't drop mid-transition.
      act(() => vi.advanceTimersByTime(11500));
      expect(onVisibilityChange).toHaveBeenLastCalledWith(true);

      // Once the 0.45s slide-out finishes, report hidden so the toggle drops.
      act(() => vi.advanceTimersByTime(450));
      expect(onVisibilityChange).toHaveBeenLastCalledWith(false);
    });
  });

  it("reports visibility false on the /colabora route", () => {
    useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
    const onVisibilityChange = vi.fn();
    renderAt("/colabora", { onVisibilityChange });
    expect(onVisibilityChange).toHaveBeenLastCalledWith(false);
  });
});
