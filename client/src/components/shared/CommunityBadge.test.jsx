import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CommunityBadge from "./CommunityBadge";

describe("<CommunityBadge>", () => {
  it("renders the community name", () => {
    render(<CommunityBadge community={{ name: "Rosario Juega" }} />);
    expect(screen.getByText("Rosario Juega")).toBeInTheDocument();
  });

  it("falls back to the slug when there is no name", () => {
    render(<CommunityBadge community={{ slug: "rosario" }} />);
    expect(screen.getByText("rosario")).toBeInTheDocument();
  });

  it("renders the logo when present", () => {
    const { container } = render(
      <CommunityBadge
        community={{ name: "X", skin: { logoLight: { url: "http://x/l.png" } } }}
      />,
    );
    // alt="" es decorativo (presentational) → consultamos el <img> directo.
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "http://x/l.png",
    );
  });

  it("renders nothing without a name or slug", () => {
    const { container } = render(<CommunityBadge community={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("tints with the community's primary accent (skin.accents.amber)", () => {
    render(
      <CommunityBadge
        community={{ name: "Rosario Juega", skin: { accents: { amber: "#e63946" } } }}
      />,
    );
    const badge = screen.getByTitle("Rosario Juega");
    expect(badge.style.getPropertyValue("--badge-color")).toBe("#e63946");
  });

  it("falls back to the default --amber when the community has no skin accent", () => {
    render(<CommunityBadge community={{ name: "TurnoCero", skin: {} }} />);
    const badge = screen.getByTitle("TurnoCero");
    expect(badge.style.getPropertyValue("--badge-color")).toBe("var(--amber)");
  });
});
