import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AdminViewToggle from "./AdminViewToggle";

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "../../context/AuthContext";

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

  it("adds the stacked class when the Bancanos FAB is visible", () => {
    useAuth.mockReturnValue({
      isActuallyAdmin: true,
      viewAsUser: false,
      setViewAsUser: vi.fn(),
    });
    render(<AdminViewToggle bancanosVisible={true} />);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/fabStacked/);
  });

  it("does NOT add the stacked class when the Bancanos FAB is hidden", () => {
    useAuth.mockReturnValue({
      isActuallyAdmin: true,
      viewAsUser: false,
      setViewAsUser: vi.fn(),
    });
    render(<AdminViewToggle bancanosVisible={false} />);
    const btn = screen.getByRole("button");
    expect(btn.className).not.toMatch(/fabStacked/);
  });

  it("defaults to un-stacked when no prop is passed", () => {
    useAuth.mockReturnValue({
      isActuallyAdmin: true,
      viewAsUser: false,
      setViewAsUser: vi.fn(),
    });
    render(<AdminViewToggle />);
    const btn = screen.getByRole("button");
    expect(btn.className).not.toMatch(/fabStacked/);
  });
});
