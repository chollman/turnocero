import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Heatmap from "./Heatmap";

function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("<Heatmap>", () => {
  it("renders weeks*7 cells (default 13 weeks)", () => {
    const { container } = render(<Heatmap heatmap={[]} />);
    const cells = container.querySelectorAll("[data-level]");
    // 91 cells in the grid + 5 in the legend scale.
    expect(cells.length).toBe(13 * 7 + 5);
  });

  it("all grid cells are level 0 when there is no activity", () => {
    const { container } = render(<Heatmap heatmap={[]} />);
    const grid = container.querySelector('[role="img"]');
    const cells = grid.querySelectorAll("[data-level]");
    cells.forEach((c) => expect(c.getAttribute("data-level")).toBe("0"));
  });

  it("buckets a busy day (6+ plays) into level 4", () => {
    const { container } = render(
      <Heatmap heatmap={[{ date: todayIso(), count: 7 }]} />,
    );
    const grid = container.querySelector('[role="img"]');
    const l4 = grid.querySelectorAll('[data-level="4"]');
    expect(l4.length).toBe(1);
  });

  it("respects the weeks prop", () => {
    const { container } = render(<Heatmap heatmap={[]} weeks={4} />);
    const grid = container.querySelector('[role="img"]');
    expect(grid.querySelectorAll("[data-level]").length).toBe(4 * 7);
  });

  it("ignores dates outside the window", () => {
    const { container } = render(
      <Heatmap heatmap={[{ date: "2000-01-01", count: 9 }]} />,
    );
    const grid = container.querySelector('[role="img"]');
    expect(grid.querySelectorAll('[data-level="4"]').length).toBe(0);
  });

  it("shows the label and legend", () => {
    render(<Heatmap heatmap={[]} />);
    expect(screen.getByText(/Calendario/i)).toBeInTheDocument();
    expect(screen.getByText("Menos")).toBeInTheDocument();
    expect(screen.getByText("Más")).toBeInTheDocument();
  });
});
