import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import SeatTrack from "./SeatTrack";

describe("<SeatTrack>", () => {
  it("renders n-1 dividers for n total seats", () => {
    const { container } = render(<SeatTrack filled={2} total={5} />);
    const dividers = container.querySelectorAll('[class*="divider"]');
    expect(dividers).toHaveLength(4);
  });

  it("fills proportionally (40% for 2/5)", () => {
    const { container } = render(<SeatTrack filled={2} total={5} />);
    const fill = container.querySelector('[class*="fill"]');
    expect(fill.getAttribute("style")).toContain("width: 40%");
  });

  it("clamps overflow (filled > total → 100%)", () => {
    const { container } = render(<SeatTrack filled={10} total={5} />);
    const fill = container.querySelector('[class*="fill"]');
    expect(fill.getAttribute("style")).toContain("width: 100%");
  });

  it("auto-detects full state when filled>=total", () => {
    const { container } = render(<SeatTrack filled={5} total={5} />);
    const fill = container.querySelector('[class*="fill"]');
    expect(fill.className).toMatch(/fill_full/);
  });

  it("explicit full=true overrides filled count", () => {
    const { container } = render(<SeatTrack filled={1} total={5} full />);
    const fill = container.querySelector('[class*="fill"]');
    expect(fill.className).toMatch(/fill_full/);
  });

  it("exposes ARIA role + values for a11y", () => {
    const { container } = render(<SeatTrack filled={3} total={6} />);
    const pb = container.querySelector('[role="progressbar"]');
    expect(pb).not.toBeNull();
    expect(pb.getAttribute("aria-valuemin")).toBe("0");
    expect(pb.getAttribute("aria-valuemax")).toBe("6");
    expect(pb.getAttribute("aria-valuenow")).toBe("3");
  });

  it("supports the 'md' variant via a separate class", () => {
    const { container } = render(
      <SeatTrack filled={1} total={3} variant="md" />,
    );
    expect(container.firstChild.className).toMatch(/track_md/);
  });
});
