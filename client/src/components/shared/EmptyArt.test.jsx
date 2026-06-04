import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  ArtMesa,
  ArtEvento,
  ArtTorneo,
  ArtCompartida,
  ArtComunidad,
  ArtNotif,
  ArtNoticia,
  ArtSearch,
} from "./EmptyArt";

const ARTS = {
  ArtMesa,
  ArtEvento,
  ArtTorneo,
  ArtCompartida,
  ArtComunidad,
  ArtNotif,
  ArtNoticia,
  ArtSearch,
};

describe("EmptyArt illustrations", () => {
  for (const [name, Art] of Object.entries(ARTS)) {
    it(`${name} renders an svg with the 150x120 viewBox`, () => {
      const { container } = render(<Art />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute("viewBox", "0 0 150 120");
    });
  }

  it("uses CSS variables for brand/structural colors (theme-aware)", () => {
    const { container } = render(<ArtEvento />);
    expect(container.innerHTML).toContain("var(--bg-card)");
    expect(container.innerHTML).toContain("var(--amber-light)");
  });
});
