import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Meeple from "./Meeple";

describe("<Meeple>", () => {
  it("renders an svg", () => {
    const { container } = render(<Meeple />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("is decorative (aria-hidden) by default", () => {
    const { container } = render(<Meeple />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
  });

  it("applies extra className", () => {
    const { container } = render(<Meeple className="foo" />);
    expect(container.querySelector("svg")).toHaveClass("foo");
  });

  it("exposes role=img and a title when given a title", () => {
    const { container, getByText } = render(<Meeple title="Meeple" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("role", "img");
    expect(svg).not.toHaveAttribute("aria-hidden");
    expect(getByText("Meeple")).toBeInTheDocument();
  });
});
