import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import FingerSelector from "./FingerSelector";

function renderApp() {
  return render(
    <MemoryRouter>
      <FingerSelector />
    </MemoryRouter>,
  );
}

// Helpers — jsdom does not implement TouchEvent, but the component reads only
// changedTouches[i].{identifier,clientX,clientY}, so we fire a plain Event
// with those properties tacked on.
function makeTouch(id, x = 100, y = 100) {
  return { identifier: id, clientX: x, clientY: y };
}
function fireTouch(target, type, touches) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  ev.changedTouches = touches;
  ev.touches = touches;
  ev.targetTouches = touches;
  target.dispatchEvent(ev);
}

beforeEach(() => {
  vi.useFakeTimers();
  navigateMock.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("<FingerSelector>", () => {
  it("starts in idle phase showing the prompt", () => {
    renderApp();
    expect(
      screen.getByText(/pongan los dedos en la pantalla/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/al menos 2 jugadores/i)).toBeInTheDocument();
  });

  it('back button calls navigate("/utilidades")', () => {
    const { container } = renderApp();
    // The back button is the first button in the screen
    const buttons = container.querySelectorAll("button");
    fireEvent.click(buttons[0]);
    expect(navigateMock).toHaveBeenCalledWith("/utilidades");
  });

  it('shows the "Necesitás al menos 2 dedos" hint with a single touch', () => {
    const { container } = renderApp();
    const screenEl = container.firstChild;
    act(() => {
      fireTouch(screenEl, "touchstart", [makeTouch(1)]);
    });
    expect(screen.getByText(/necesitás al menos 2 dedos/i)).toBeInTheDocument();
  });

  it("starts countdown once two fingers are down", () => {
    const { container } = renderApp();
    const screenEl = container.firstChild;
    act(() => {
      fireTouch(screenEl, "touchstart", [
        makeTouch(1, 100, 100),
        makeTouch(2, 200, 200),
      ]);
    });
    // Initial countdown display is 3
    expect(screen.getByText("3")).toBeInTheDocument();
    // After 1s, becomes 2
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("cancels countdown when fingers drop below 2", () => {
    const { container } = renderApp();
    const screenEl = container.firstChild;
    act(() => {
      fireTouch(screenEl, "touchstart", [
        makeTouch(1, 100, 100),
        makeTouch(2, 200, 200),
      ]);
    });
    expect(screen.getByText("3")).toBeInTheDocument();
    // Lift one finger -> back to waiting hint
    act(() => {
      fireTouch(screenEl, "touchend", [makeTouch(1, 100, 100)]);
    });
    expect(screen.getByText(/necesitás al menos 2 dedos/i)).toBeInTheDocument();
  });

  it("renders one dot per active touch", () => {
    const { container } = renderApp();
    const screenEl = container.firstChild;
    act(() => {
      fireTouch(screenEl, "touchstart", [
        makeTouch(1, 100, 100),
        makeTouch(2, 200, 200),
        makeTouch(3, 300, 300),
      ]);
    });
    const dots = container.querySelectorAll('[class*="dot"]');
    // Each dot has a child inner element — filter for the outer wrappers
    const wrappers = Array.from(dots).filter(
      (el) => el.classList.value.match(/\bdot(_|$)/) || el.style.left,
    );
    expect(wrappers.length).toBeGreaterThanOrEqual(3);
  });

  it("after countdown finishes a winner is selected and replay button appears", () => {
    const { container } = renderApp();
    const screenEl = container.firstChild;
    act(() => {
      fireTouch(screenEl, "touchstart", [
        makeTouch(1, 100, 100),
        makeTouch(2, 200, 200),
      ]);
    });
    // Advance through the full 3s countdown
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    // Then advance the 700ms selecting→result delay
    act(() => {
      vi.advanceTimersByTime(800);
    });
    // Replay button is the last button (rendered only in result phase)
    const buttons = container.querySelectorAll("button");
    // back button + replay button = 2
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });
});
