import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

import ForgotPassword from "./ForgotPassword";
import { useAuth } from "../../context/AuthContext";

beforeEach(() => {
  server.use(
    http.get("/api/tables/showcase", () =>
      HttpResponse.json({ total: 0, table: null }),
    ),
  );
});

function renderPage(requestPasswordReset = vi.fn()) {
  useAuth.mockReturnValue({ requestPasswordReset });
  return render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>,
  );
}

describe("<ForgotPassword>", () => {
  it("renders the email field + submit button", () => {
    renderPage();
    expect(screen.getByPlaceholderText("tu@email.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /enviar link/i }),
    ).toBeInTheDocument();
  });

  it("submit is disabled until email is filled", () => {
    renderPage();
    const submit = screen.getByRole("button", { name: /enviar link/i });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("tu@email.com"), {
      target: { value: "a@b.com" },
    });
    expect(submit).not.toBeDisabled();
  });

  it("on success shows the generic confirmation message (anti-enumeration)", async () => {
    const requestPasswordReset = vi.fn().mockResolvedValue(undefined);
    renderPage(requestPasswordReset);
    fireEvent.change(screen.getByPlaceholderText("tu@email.com"), {
      target: { value: "a@b.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar link/i }));

    await waitFor(() =>
      expect(requestPasswordReset).toHaveBeenCalledWith("a@b.com"),
    );
    expect(
      await screen.findByText(/si existe una cuenta/i),
    ).toBeInTheDocument();
    // Form is gone after submit
    expect(
      screen.queryByPlaceholderText("tu@email.com"),
    ).not.toBeInTheDocument();
  });

  it("shows API error message on failure (rate limit, etc.)", async () => {
    const requestPasswordReset = vi.fn().mockRejectedValue({
      response: { data: { message: "Too many attempts" } },
    });
    renderPage(requestPasswordReset);
    fireEvent.change(screen.getByPlaceholderText("tu@email.com"), {
      target: { value: "a@b.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar link/i }));

    expect(await screen.findByText("Too many attempts")).toBeInTheDocument();
  });

  it("exposes a link back to /login", () => {
    renderPage();
    expect(
      screen.getByRole("link", { name: /volver al login/i }),
    ).toHaveAttribute("href", "/login");
  });
});
