import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AdminViewToggle from "./AdminViewToggle";

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));
vi.mock("../../context/SiteConfigContext", () => ({
  useSiteConfig: vi.fn(),
}));

import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";

beforeEach(() => {
  // Default: colabora section enabled (FAB visible → stacked layout).
  useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
});

describe("<AdminViewToggle>", () => {
  it("renders nothing for non-admins", () => {
    useAuth.mockReturnValue({
      isActuallyAdmin: false,
      viewAsUser: false,
      setViewAsUser: vi.fn(),
    });
    const { container } = render(<AdminViewToggle />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the toggle for admins with "Ver como usuario" label when not viewing-as-user', () => {
    useAuth.mockReturnValue({
      isActuallyAdmin: true,
      viewAsUser: false,
      setViewAsUser: vi.fn(),
    });
    render(<AdminViewToggle />);
    expect(
      screen.getByRole("button", { name: "Ver como usuario" }),
    ).toBeInTheDocument();
  });

  it('renders "Volver a vista admin" label when viewing-as-user', () => {
    useAuth.mockReturnValue({
      isActuallyAdmin: true,
      viewAsUser: true,
      setViewAsUser: vi.fn(),
    });
    render(<AdminViewToggle />);
    expect(
      screen.getByRole("button", { name: "Volver a vista admin" }),
    ).toBeInTheDocument();
  });

  it("toggles viewAsUser when clicked", () => {
    const setViewAsUser = vi.fn();
    useAuth.mockReturnValue({
      isActuallyAdmin: true,
      viewAsUser: false,
      setViewAsUser,
    });
    render(<AdminViewToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(setViewAsUser).toHaveBeenCalledWith(true);
  });

  it("toggles back to admin view when already viewing-as-user", () => {
    const setViewAsUser = vi.fn();
    useAuth.mockReturnValue({
      isActuallyAdmin: true,
      viewAsUser: true,
      setViewAsUser,
    });
    render(<AdminViewToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(setViewAsUser).toHaveBeenCalledWith(false);
  });

  it("adds the stacked class when colabora section is enabled (FAB present)", () => {
    useAuth.mockReturnValue({
      isActuallyAdmin: true,
      viewAsUser: false,
      setViewAsUser: vi.fn(),
    });
    useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
    render(<AdminViewToggle />);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/fabStacked/);
  });

  it("does NOT add the stacked class when colabora section is disabled", () => {
    useAuth.mockReturnValue({
      isActuallyAdmin: true,
      viewAsUser: false,
      setViewAsUser: vi.fn(),
    });
    useSiteConfig.mockReturnValue({ isSectionEnabled: () => false });
    render(<AdminViewToggle />);
    const btn = screen.getByRole("button");
    expect(btn.className).not.toMatch(/fabStacked/);
  });
});
