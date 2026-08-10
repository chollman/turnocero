import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CommitBadge from "./CommitBadge";

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "../../context/AuthContext";

describe("<CommitBadge>", () => {
  it("renders nothing for non-admins", () => {
    useAuth.mockReturnValue({ isActuallyAdmin: false });
    const { container } = render(<CommitBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the commit count for admins", () => {
    useAuth.mockReturnValue({ isActuallyAdmin: true });
    render(<CommitBadge />);
    expect(screen.getByText(`#${__COMMIT_COUNT__}`)).toBeInTheDocument();
  });
});
