import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import SectionGate from "./SectionGate";

// Mock the three context/hook dependencies so we can drive them per test.
vi.mock("../../context/SiteConfigContext", () => ({ useSiteConfig: vi.fn() }));
vi.mock("../../context/CommunityContext", () => ({ useCommunity: vi.fn() }));
vi.mock("../../hooks/useSectionEnabled", () => ({ useSectionEnabled: vi.fn() }));

import { useSiteConfig } from "../../context/SiteConfigContext";
import { useCommunity } from "../../context/CommunityContext";
import { useSectionEnabled } from "../../hooks/useSectionEnabled";

function setup({ configLoaded = true, communityLoaded = true, enabled }) {
  useSiteConfig.mockReturnValue({ loaded: configLoaded });
  useCommunity.mockReturnValue({ loaded: communityLoaded });
  useSectionEnabled.mockReturnValue(
    typeof enabled === "function" ? enabled : () => enabled,
  );
}

function renderWithRouter(ui, { initialEntries = ["/"] } = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={ui} />
        <Route path="/elsewhere" element={<div>elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("<SectionGate>", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders null while site config is not loaded yet", () => {
    setup({ configLoaded: false, enabled: true });
    const { container } = renderWithRouter(
      <SectionGate section="mesas">
        <div>kids</div>
      </SectionGate>,
    );
    expect(container.textContent).toBe("");
  });

  it("renders null while the community context is not loaded yet", () => {
    setup({ communityLoaded: false, enabled: true });
    const { container } = renderWithRouter(
      <SectionGate section="mesas">
        <div>kids</div>
      </SectionGate>,
    );
    expect(container.textContent).toBe("");
  });

  it("renders children when the section is enabled", () => {
    setup({ enabled: (s) => s === "compartidas" });
    renderWithRouter(
      <SectionGate section="compartidas">
        <div>visible</div>
      </SectionGate>,
    );
    expect(screen.getByText("visible")).toBeInTheDocument();
  });

  it('redirects to "/" when the section is disabled', () => {
    setup({ enabled: false });
    render(
      <MemoryRouter initialEntries={["/mesas"]}>
        <Routes>
          <Route
            path="/mesas"
            element={
              <SectionGate section="mesas">
                <div>hidden</div>
              </SectionGate>
            }
          />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText("hidden")).not.toBeInTheDocument();
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("honors custom redirectTo", () => {
    setup({ enabled: false });
    render(
      <MemoryRouter initialEntries={["/mesas"]}>
        <Routes>
          <Route
            path="/mesas"
            element={
              <SectionGate section="mesas" redirectTo="/elsewhere">
                <div>hidden</div>
              </SectionGate>
            }
          />
          <Route path="/elsewhere" element={<div>landed</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("landed")).toBeInTheDocument();
  });
});
