import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import MesaTile from "./MesaTile";

describe("<MesaTile>", () => {
  it("renders an <img> when imageUrl is provided", () => {
    const { container } = render(
      <MesaTile game="Catan" imageUrl="https://example.com/catan.jpg" />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe("https://example.com/catan.jpg");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders an SVG mosaic when no imageUrl is provided", () => {
    const { container } = render(<MesaTile game="Catan" seed={3} />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("produces the same SVG for the same game + seed (deterministic)", () => {
    const a = render(<MesaTile game="Wingspan" seed={5} />).container
      .innerHTML;
    const b = render(<MesaTile game="Wingspan" seed={5} />).container
      .innerHTML;
    expect(a).toBe(b);
  });

  it("produces a different SVG for a different seed", () => {
    const a = render(<MesaTile game="Wingspan" seed={1} />).container
      .innerHTML;
    const b = render(<MesaTile game="Wingspan" seed={42} />).container
      .innerHTML;
    expect(a).not.toBe(b);
  });

  it("is aria-hidden by default (decorative)", () => {
    const { container } = render(<MesaTile game="Catan" />);
    expect(container.querySelector("svg").getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("hides alt text when ariaHidden=true even for images", () => {
    const { container } = render(
      <MesaTile
        game="Catan"
        imageUrl="https://example.com/catan.jpg"
        ariaHidden={true}
      />,
    );
    const img = container.querySelector("img");
    expect(img.getAttribute("alt")).toBe("");
  });
});
