import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import * as icons from "./playFormIcons";

describe("playFormIcons", () => {
  it("exporta los 9 íconos y todos renderizan un <svg> decorativo", () => {
    const names = Object.keys(icons);
    expect(names).toHaveLength(9);
    for (const name of names) {
      const Icon = icons[name];
      const { container, unmount } = render(<Icon />);
      const svg = container.querySelector("svg");
      expect(svg, `${name} debería renderizar un <svg>`).toBeInTheDocument();
      expect(svg).toHaveAttribute("aria-hidden", "true");
      unmount();
    }
  });
});
