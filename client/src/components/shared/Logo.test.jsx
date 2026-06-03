import { describe, it, expect, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import Logo from "./Logo";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

describe("<Logo>", () => {
  it("renders the dark logo when data-theme is unset", () => {
    render(<Logo className="x" />);
    expect(screen.getByRole("img", { name: "TurnoCero" })).toHaveAttribute(
      "src",
      "/logo.svg",
    );
  });

  it('renders the dark logo when data-theme="dark"', () => {
    document.documentElement.setAttribute("data-theme", "dark");
    render(<Logo />);
    expect(screen.getByRole("img", { name: "TurnoCero" })).toHaveAttribute(
      "src",
      "/logo.svg",
    );
  });

  it('renders the light logo when data-theme="light"', () => {
    document.documentElement.setAttribute("data-theme", "light");
    render(<Logo />);
    expect(screen.getByRole("img", { name: "TurnoCero" })).toHaveAttribute(
      "src",
      "/logo-light.svg",
    );
  });

  it("reacts to runtime theme changes via MutationObserver", async () => {
    render(<Logo />);
    expect(screen.getByRole("img", { name: "TurnoCero" })).toHaveAttribute(
      "src",
      "/logo.svg",
    );

    await act(async () => {
      document.documentElement.setAttribute("data-theme", "light");
      await Promise.resolve();
    });
    expect(screen.getByRole("img", { name: "TurnoCero" })).toHaveAttribute(
      "src",
      "/logo-light.svg",
    );

    await act(async () => {
      document.documentElement.setAttribute("data-theme", "dark");
      await Promise.resolve();
    });
    expect(screen.getByRole("img", { name: "TurnoCero" })).toHaveAttribute(
      "src",
      "/logo.svg",
    );
  });

  it("respects a custom alt", () => {
    render(<Logo alt="Marca" />);
    expect(screen.getByRole("img", { name: "Marca" })).toBeInTheDocument();
  });

  it("uses the per-theme src override when provided", () => {
    document.documentElement.setAttribute("data-theme", "light");
    render(<Logo srcLight="http://x/l.png" srcDark="http://x/d.png" />);
    expect(screen.getByRole("img", { name: "TurnoCero" })).toHaveAttribute(
      "src",
      "http://x/l.png",
    );
  });

  it("falls back to the static asset when the override for the active theme is empty", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    render(<Logo srcLight="http://x/l.png" srcDark="" />);
    expect(screen.getByRole("img", { name: "TurnoCero" })).toHaveAttribute(
      "src",
      "/logo.svg",
    );
  });
});
