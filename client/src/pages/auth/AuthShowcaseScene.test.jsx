import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import AuthShowcaseScene from "./AuthShowcaseScene";

describe("<AuthShowcaseScene>", () => {
  it("renders a decorative (aria-hidden) svg scene", () => {
    const { container } = render(<AuthShowcaseScene />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    // A handful of board-game elements (cards, dice, meeples, tiles, hexes).
    expect(container.querySelectorAll("rect").length).toBeGreaterThan(5);
    expect(container.querySelectorAll("polygon").length).toBeGreaterThan(5);
  });
});
