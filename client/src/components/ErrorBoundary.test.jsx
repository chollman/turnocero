import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AllProviders } from "../test/wrappers/AllProviders";
import ErrorBoundary from "./ErrorBoundary";

function Boom() {
  throw new Error("kaboom");
}

let errorSpy;
beforeEach(() => {
  // getDerivedStateFromError still logs the thrown error to the console;
  // silence it so the test output stays clean.
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
});

describe("<ErrorBoundary>", () => {
  it("renders its children when there is no error", () => {
    render(
      <ErrorBoundary>
        <p>contenido sano</p>
      </ErrorBoundary>,
      { wrapper: AllProviders },
    );
    expect(screen.getByText("contenido sano")).toBeInTheDocument();
  });

  it("renders the 500 screen when a child throws during render", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
      { wrapper: AllProviders },
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "500" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/volcó el tablero/i)).toBeInTheDocument();
  });
});
