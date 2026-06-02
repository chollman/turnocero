import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import MathTradeSkeleton from "./MathTradeSkeleton";

describe("MathTradeSkeleton", () => {
  it("renderiza un placeholder oculto a accesibilidad", () => {
    const { container } = render(<MathTradeSkeleton />);
    const card = container.firstChild;
    expect(card).toBeTruthy();
    expect(card).toHaveAttribute("aria-hidden", "true");
  });
});
