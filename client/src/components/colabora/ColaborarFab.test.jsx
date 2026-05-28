import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ColaborarFab from "./ColaborarFab";

vi.mock("../../context/SiteConfigContext", () => ({
  useSiteConfig: vi.fn(),
}));

import { useSiteConfig } from "../../context/SiteConfigContext";

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
