import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ViewAsUserBanner from "./ViewAsUserBanner";

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "../../context/AuthContext";

describe("<ViewAsUserBanner>", () => {
  it("renders nothing when user is not actually admin", () => {
    useAuth.mockReturnValue({
      isActuallyAdmin: false,
      viewAsUser: true,
      setViewAsUser: vi.fn(),
    });
    const { container } = render(<ViewAsUserBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when admin is not viewing-as-user", () => {
    useAuth.mockReturnValue({
      isActuallyAdmin: true,
      viewAsUser: false,
      setViewAsUser: vi.fn(),
    });
    const { container } = render(<ViewAsUserBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the banner when admin is viewing-as-user", () => {
    useAuth.mockReturnValue({
      isActuallyAdmin: true,
      viewAsUser: true,
      setViewAsUser: vi.fn(),
    });
    render(<ViewAsUserBanner />);
    expect(screen.getByText(/viendo como usuario/i)).toBeInTheDocument();
  });

  it("exiting viewAsUser mode is one click away", () => {
    const setViewAsUser = vi.fn();
    useAuth.mockReturnValue({
      isActuallyAdmin: true,
      viewAsUser: true,
      setViewAsUser,
    });
    render(<ViewAsUserBanner />);
    fireEvent.click(screen.getByRole("button"));
    expect(setViewAsUser).toHaveBeenCalledWith(false);
  });
});
