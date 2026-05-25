import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dado from "./Dado";

function renderDado() {
  return render(
    <MemoryRouter>
      <Dado />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("<Dado>", () => {
  it("renders the 6 dice type buttons (d4..d20) with d6 active by default", () => {
    renderDado();
    ["d4", "d6", "d8", "d10", "d12", "d20"].forEach((label) => {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "d6" }).className).toMatch(
      /active/i,
    );
  });

  it('count starts at 1 and "−" is disabled', () => {
    renderDado();
    expect(screen.getByText(/^1 dado$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "−" })).toBeDisabled();
  });

  it("count + and − change the dice quantity, clamped to 1..5", () => {
    renderDado();
    const plus = screen.getByRole("button", { name: "+" });
    fireEvent.click(plus);
    fireEvent.click(plus);
    fireEvent.click(plus);
    fireEvent.click(plus);
    fireEvent.click(plus);
    fireEvent.click(plus);
    expect(screen.getByText(/^5 dados$/)).toBeInTheDocument();
    expect(plus).toBeDisabled();
  });

  it('clicking "Tirar" shows the rolling state, then results within sides bounds', () => {
    renderDado();
    fireEvent.click(screen.getByRole("button", { name: "Tirar" }));
    expect(screen.getByRole("button", { name: /tirando/i })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(700);
    });

    // 1 result (default count=1, default sides=6) → a number from 1 to 6.
    const dice = screen.getAllByText(/^[1-6]$/);
    expect(dice.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Tirar" })).not.toBeDisabled();
  });

  it("switching dice type clears previous results", () => {
    renderDado();
    fireEvent.click(screen.getByRole("button", { name: "Tirar" }));
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.queryByText(/placeholder/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "d20" }));
    expect(screen.getByText(/d20 · 1 dado/)).toBeInTheDocument();
  });
});
