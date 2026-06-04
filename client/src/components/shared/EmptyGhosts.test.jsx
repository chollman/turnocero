import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  GhostMesa,
  GhostRows,
  GhostPolaroids,
  GhostMembers,
} from "./EmptyGhosts";

describe("EmptyGhosts skeletons", () => {
  it("GhostMesa renders 4 decorative cards", () => {
    const { container } = render(<GhostMesa />);
    const root = container.firstChild;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root.children).toHaveLength(4);
  });

  it("GhostRows renders 4 decorative rows", () => {
    const { container } = render(<GhostRows />);
    const root = container.firstChild;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root.children).toHaveLength(4);
  });

  it("GhostPolaroids renders 5 polaroids", () => {
    const { container } = render(<GhostPolaroids />);
    expect(container.firstChild.children).toHaveLength(5);
  });

  it("GhostMembers renders 4 carnets", () => {
    const { container } = render(<GhostMembers />);
    expect(container.firstChild.children).toHaveLength(4);
  });
});
