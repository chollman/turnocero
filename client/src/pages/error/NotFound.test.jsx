import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AllProviders } from "../../test/wrappers/AllProviders";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

const isSectionEnabled = vi.fn(() => true);
vi.mock("../../context/SiteConfigContext", () => ({
  useSiteConfig: () => ({ isSectionEnabled }),
}));

import NotFound from "./NotFound";

function renderNotFound() {
  return render(<NotFound />, { wrapper: AllProviders });
}

beforeEach(() => {
  mockNavigate.mockClear();
  isSectionEnabled.mockClear();
  isSectionEnabled.mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("<NotFound>", () => {
  it("renders the 404 error screen", () => {
    renderNotFound();
    expect(
      screen.getByRole("heading", { level: 1, name: "404" }),
    ).toBeInTheDocument();
  });

  it("shows quick links only for enabled sections", () => {
    isSectionEnabled.mockImplementation((s) => s !== "mesas");
    renderNotFound();
    expect(screen.queryByRole("link", { name: /Mesas/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Eventos/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Compartidas/ })).toBeInTheDocument();
  });

  it("navigates home from the primary action", () => {
    renderNotFound();
    fireEvent.click(screen.getByRole("button", { name: /Volver al inicio/ }));
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("goes back when there is in-app history", () => {
    const original = window.history.state;
    window.history.replaceState({ idx: 3 }, "");
    renderNotFound();
    fireEvent.click(screen.getByRole("button", { name: /Página anterior/ }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
    window.history.replaceState(original, "");
  });

  it("falls back to home when there is no in-app history", () => {
    const original = window.history.state;
    window.history.replaceState({ idx: 0 }, "");
    renderNotFound();
    fireEvent.click(screen.getByRole("button", { name: /Página anterior/ }));
    expect(mockNavigate).toHaveBeenCalledWith("/");
    window.history.replaceState(original, "");
  });
});
