import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import usePageTransition from "./usePageTransition";

function Probe() {
  const { displayLocation, className, handleAnimationEnd } = usePageTransition();
  // Botones que invocan handleAnimationEnd con un evento controlado, para
  // testear la lógica del handler sin depender del despacho DOM de un
  // AnimationEvent real (que el CSS dispara en la app de verdad). `self` simula
  // que la animación es del propio wrapper (target === currentTarget); `child`
  // simula un evento burbujeado de un hijo (target !== currentTarget).
  const node = { id: "wrapper" };
  return (
    <div>
      <span data-testid="display">{displayLocation.pathname}</span>
      <span data-testid="class">{className}</span>
      <button
        data-testid="end-self"
        onClick={() => handleAnimationEnd({ target: node, currentTarget: node })}
      >
        end-self
      </button>
      <button
        data-testid="end-child"
        onClick={() =>
          handleAnimationEnd({ target: { id: "child" }, currentTarget: node })
        }
      >
        end-child
      </button>
      <div className={className}>
        <Routes location={displayLocation}>
          <Route path="/" element={<div data-testid="home">Home</div>} />
          <Route path="/mesas" element={<div data-testid="mesas">Mesas</div>} />
          <Route
            path="/mesas/:id"
            element={<div data-testid="detail">Detail</div>}
          />
          <Route
            path="/compartidas"
            element={<div data-testid="compartidas">Compartidas</div>}
          />
          <Route path="/login" element={<div data-testid="login">Login</div>} />
          <Route
            path="/register"
            element={<div data-testid="register">Register</div>}
          />
        </Routes>
      </div>
    </div>
  );
}

function renderHookApp(initial = "/") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Link to="/mesas">Mesas</Link>
      <Link to="/mesas/123">Detail</Link>
      <Link to="/compartidas">Compartidas</Link>
      <Link to="/register">Register</Link>
      <Probe />
    </MemoryRouter>,
  );
}

const displayPath = () => screen.getByTestId("display").textContent;
const cls = () => screen.getByTestId("class").textContent;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usePageTransition", () => {
  it("starts displaying the initial location with no slide class", () => {
    renderHookApp("/");
    expect(displayPath()).toBe("/");
    expect(cls()).toBe("");
    expect(screen.getByTestId("home")).toBeInTheDocument();
  });

  it("swaps the displayed location instantly within the same section", async () => {
    renderHookApp("/mesas");
    expect(screen.getByTestId("mesas")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Detail"));
    await waitFor(() => expect(displayPath()).toBe("/mesas/123"));
    expect(cls()).toBe("");
    expect(screen.getByTestId("detail")).toBeInTheDocument();
  });

  it("swaps instantly between auth screens (login ↔ register) with no slide", async () => {
    renderHookApp("/login");
    expect(screen.getByTestId("login")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Register"));
    await waitFor(() => expect(displayPath()).toBe("/register"));
    expect(cls()).toBe("");
    expect(screen.getByTestId("register")).toBeInTheDocument();
  });

  it("on a cross-section nav: slides out, lags the content, then swaps on animationEnd", async () => {
    renderHookApp("/mesas");
    fireEvent.click(screen.getByText("Compartidas"));

    // Phase 'out': slide class applied, but content still on the old location.
    await waitFor(() => expect(cls()).toContain("slideOut"));
    expect(displayPath()).toBe("/mesas");
    expect(screen.getByTestId("mesas")).toBeInTheDocument();

    // animationEnd on the wrapper itself → swap to new location + slide in.
    fireEvent.click(screen.getByTestId("end-self"));
    expect(displayPath()).toBe("/compartidas");
    expect(cls()).toContain("slideIn");
    expect(screen.getByTestId("compartidas")).toBeInTheDocument();

    // animationEnd again (phase 'in') → back to idle, no class.
    fireEvent.click(screen.getByTestId("end-self"));
    expect(cls()).toBe("");
  });

  it("ignores animationEnd events bubbling up from children", async () => {
    renderHookApp("/mesas");
    fireEvent.click(screen.getByText("Compartidas"));
    await waitFor(() => expect(cls()).toContain("slideOut"));

    // Event from a child → target !== currentTarget → handler no-ops, no swap.
    fireEvent.click(screen.getByTestId("end-child"));
    expect(displayPath()).toBe("/mesas");
    expect(cls()).toContain("slideOut");
  });

  it("with prefers-reduced-motion, cross-section nav swaps instantly (no slide, no hang)", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));

    renderHookApp("/mesas");
    fireEvent.click(screen.getByText("Compartidas"));

    // No slide class ever applied; the displayed content swaps right away.
    await waitFor(() => expect(displayPath()).toBe("/compartidas"));
    expect(cls()).toBe("");
    expect(screen.getByTestId("compartidas")).toBeInTheDocument();
  });
});
