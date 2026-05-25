import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import BoardGameBackground from "./BoardGameBackground";

describe("<BoardGameBackground>", () => {
  it("renders an aria-hidden decorative container", () => {
    const { container } = render(<BoardGameBackground />);
    const root = container.firstChild;
    expect(root).toBeTruthy();
    expect(root).toHaveAttribute("aria-hidden", "true");
  });

  it("renders 18 board game pieces", () => {
    const { container } = render(<BoardGameBackground />);
    const pieces = container.firstChild.querySelectorAll(":scope > span");
    expect(pieces.length).toBe(18);
  });

  it("each piece has inline style for animation and position", () => {
    const { container } = render(<BoardGameBackground />);
    const pieces = container.firstChild.querySelectorAll(":scope > span");
    for (const p of pieces) {
      expect(p.style.left).toBeTruthy();
      expect(p.style.fontSize).toBeTruthy();
      expect(p.style.animationDuration).toBeTruthy();
    }
  });
});
