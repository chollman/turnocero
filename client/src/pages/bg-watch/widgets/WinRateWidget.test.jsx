import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import WinRateWidget from "./WinRateWidget";

describe("<WinRateWidget>", () => {
  it("computes the rounded percentage", () => {
    render(<WinRateWidget wins={2} rated={3} />);
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText(/en 3 partidas medidas/i)).toBeInTheDocument();
  });

  it("renders 100% when all measured plays are wins", () => {
    render(<WinRateWidget wins={5} rated={5} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it('shows "—" when there are no measured plays', () => {
    render(<WinRateWidget wins={0} rated={0} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/partidas medidas/i)).toBeNull();
  });

  it("uses singular copy for a single measured play", () => {
    render(<WinRateWidget wins={1} rated={1} />);
    expect(screen.getByText(/en 1 partida medida/i)).toBeInTheDocument();
  });

  it("always shows the label", () => {
    render(<WinRateWidget wins={0} rated={0} />);
    expect(screen.getByText(/win rate/i)).toBeInTheDocument();
  });
});
