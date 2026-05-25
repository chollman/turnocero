import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import ResetPassword from "./ResetPassword";
import { useAuth } from "../../context/AuthContext";

function renderPage({
  url = "/restablecer-contrasenia?token=abc&email=a@b.com",
  resetPassword,
} = {}) {
  useAuth.mockReturnValue({ resetPassword: resetPassword || vi.fn() });
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ResetPassword />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateMock.mockReset();
  sessionStorage.clear();
  server.use(
    http.get("/api/tables/showcase", () =>
      HttpResponse.json({ total: 0, table: null }),
    ),
  );
});

describe("<ResetPassword>", () => {
  it("shows the invalid-link error when token is missing", () => {
    renderPage({ url: "/restablecer-contrasenia?email=a@b.com" });
    expect(screen.getByText(/link es inválido/i)).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/m[ií]n. 8 caracteres/i),
    ).not.toBeInTheDocument();
  });

  it("shows the invalid-link error when email is missing", () => {
    renderPage({ url: "/restablecer-contrasenia?token=abc" });
    expect(screen.getByText(/link es inválido/i)).toBeInTheDocument();
  });

  it("renders the form when both token + email are present", () => {
    renderPage();
    expect(
      screen.getByPlaceholderText(/m[ií]n. 8 caracteres/i),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/repet[ií] tu contrase/i),
    ).toBeInTheDocument();
  });

  it("blocks submit when passwords do not match", () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/m[ií]n. 8 caracteres/i), {
      target: { value: "Password123" },
    });
    fireEvent.change(screen.getByPlaceholderText(/repet[ií] tu contrase/i), {
      target: { value: "Diff1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar contrase/i }));
    expect(
      screen.getByText("Las contraseñas no coinciden"),
    ).toBeInTheDocument();
  });

  it("blocks submit when password fails complexity rules", () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/m[ií]n. 8 caracteres/i), {
      target: { value: "weakpass" },
    });
    fireEvent.change(screen.getByPlaceholderText(/repet[ií] tu contrase/i), {
      target: { value: "weakpass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar contrase/i }));
    expect(screen.getByText(/al menos 8 caracteres/i)).toBeInTheDocument();
  });

  it("on success calls resetPassword(email, token, password) and navigates to /login with a flash", async () => {
    const resetPassword = vi.fn().mockResolvedValue(undefined);
    renderPage({ resetPassword });

    fireEvent.change(screen.getByPlaceholderText(/m[ií]n. 8 caracteres/i), {
      target: { value: "Password123" },
    });
    fireEvent.change(screen.getByPlaceholderText(/repet[ií] tu contrase/i), {
      target: { value: "Password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar contrase/i }));

    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith(
        "a@b.com",
        "abc",
        "Password123",
      ),
    );
    expect(navigateMock).toHaveBeenCalledWith("/login", { replace: true });
    expect(sessionStorage.getItem("flashMessage")).toMatch(
      /contraseña actualizada/i,
    );
  });

  it("shows the API error on failure", async () => {
    const resetPassword = vi.fn().mockRejectedValue({
      response: {
        data: { message: "El link es inválido o expiró. Pedí uno nuevo." },
      },
    });
    renderPage({ resetPassword });

    fireEvent.change(screen.getByPlaceholderText(/m[ií]n. 8 caracteres/i), {
      target: { value: "Password123" },
    });
    fireEvent.change(screen.getByPlaceholderText(/repet[ií] tu contrase/i), {
      target: { value: "Password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar contrase/i }));

    expect(
      await screen.findByText(/inv[aá]lido o expir[oó]/i),
    ).toBeInTheDocument();
  });
});
