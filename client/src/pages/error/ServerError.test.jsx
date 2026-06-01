import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AllProviders } from "../../test/wrappers/AllProviders";
import ServerError from "./ServerError";

function renderServerError(props = {}) {
  return render(<ServerError {...props} />, { wrapper: AllProviders });
}

describe("<ServerError>", () => {
  it("renders the 500 error screen", () => {
    renderServerError();
    expect(
      screen.getByRole("heading", { level: 1, name: "500" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/volcó el tablero/i)).toBeInTheDocument();
  });

  it("invokes onRetry when 'Reintentar' is clicked", () => {
    const onRetry = vi.fn();
    renderServerError({ onRetry });
    fireEvent.click(screen.getByRole("button", { name: /Reintentar/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("invokes onHome when 'Ir al inicio' is clicked", () => {
    const onHome = vi.fn();
    renderServerError({ onHome });
    fireEvent.click(screen.getByRole("button", { name: /Ir al inicio/ }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});
