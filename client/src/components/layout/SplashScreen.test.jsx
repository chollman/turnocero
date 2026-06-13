import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";

const brandNameMock = vi.fn(() => "TurnoCero");
vi.mock("../../hooks/useBrandName", () => ({
  useBrandName: () => brandNameMock(),
}));

import SplashScreen from "./SplashScreen";

beforeEach(() => {
  brandNameMock.mockReturnValue("TurnoCero");
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("<SplashScreen>", () => {
  it("renders the animated T0 mark, wordmark and loader copy when visible", () => {
    render(<SplashScreen visible={true} />);
    // Default brand → inline animated T0 mark (role=img, aria-label).
    expect(screen.getByLabelText("TurnoCero")).toBeInTheDocument();
    // Wordmark splits TurnoCero into "Turno" + accented "Cero".
    expect(screen.getByText("Cero")).toBeInTheDocument();
    expect(screen.getByText(/board game meetups/i)).toBeInTheDocument();
    expect(screen.getByText("Preparando tu mesa")).toBeInTheDocument();
  });

  it("shows the community brand name and does not split it when not TurnoCero", () => {
    brandNameMock.mockReturnValue("El Clu");
    render(<SplashScreen visible={true} />);
    expect(screen.getByText("El Clu")).toBeInTheDocument();
    expect(screen.queryByText("Cero")).not.toBeInTheDocument();
  });

  it("renders the three dice pips", () => {
    const { container } = render(<SplashScreen visible={true} />);
    const root = container.querySelector('div[aria-hidden="true"]');
    expect(root).toBeTruthy();
    // Three pulsing dice pips inside the loader's pip trio container.
    const pips = root.querySelectorAll('[class*="pips"] > span');
    expect(pips.length).toBe(3);
  });

  it("keeps rendering after visible=false until the fade-out timer completes (700ms)", () => {
    const { rerender, container } = render(<SplashScreen visible={true} />);
    expect(container.firstChild).not.toBeNull();
    rerender(<SplashScreen visible={false} />);
    // Still rendered immediately with the hiding class
    expect(container.firstChild).not.toBeNull();
    // After 700ms it unmounts
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(container.firstChild).toBeNull();
  });
});
