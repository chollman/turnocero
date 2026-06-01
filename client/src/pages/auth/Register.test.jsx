import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
// OAuthButtons tiene su propio test; lo stubeamos para no arrastrar sus
// dependencias (GoogleOAuthProvider/ThemeProvider) al render de Register.
vi.mock("./OAuthButtons", () => ({ default: () => null }));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import Register from "./Register";
import { useAuth } from "../../context/AuthContext";

function fillValidForm({
  password = "Password123",
  confirm = "Password123",
} = {}) {
  fireEvent.change(screen.getByPlaceholderText("tu_nombre_de_jugador"), {
    target: { value: "newcomer" },
  });
  fireEvent.change(screen.getByPlaceholderText("tu@email.com"), {
    target: { value: "new@b.com" },
  });
  fireEvent.change(
    screen.getByPlaceholderText("Mín. 8 caracteres, 1 mayúscula y 1 número"),
    {
      target: { value: password },
    },
  );
  fireEvent.change(screen.getByPlaceholderText("Repetí tu contraseña"), {
    target: { value: confirm },
  });
}

beforeEach(() => {
  navigateMock.mockReset();
  server.use(
    http.get("/api/tables/showcase", () =>
      HttpResponse.json({ total: 0, table: null }),
    ),
  );
});

function renderRegister(register = vi.fn()) {
  useAuth.mockReturnValue({ register });
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  );
}

describe("<Register>", () => {
  it("blocks submit and shows error when passwords do not match", () => {
    const register = vi.fn();
    renderRegister(register);
    fillValidForm({ password: "Password123", confirm: "Different1" });
    fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));
    expect(
      screen.getByText("Las contraseñas no coinciden"),
    ).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("blocks submit when password fails complexity rules", () => {
    const register = vi.fn();
    renderRegister(register);
    fillValidForm({ password: "weakpass", confirm: "weakpass" });
    fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));
    expect(screen.getByText(/al menos 8 caracteres/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("calls register(username, email, password) on valid submit and navigates to /verificar-email", async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    renderRegister(register);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith(
        "newcomer",
        "new@b.com",
        "Password123",
      );
    });
    expect(navigateMock).toHaveBeenCalledWith(
      "/verificar-email",
      expect.objectContaining({
        state: expect.objectContaining({ email: "new@b.com" }),
      }),
    );
  });

  it("shows the API error message when register() rejects", async () => {
    const register = vi.fn().mockRejectedValue({
      response: { data: { message: "Email or username already in use" } },
    });
    renderRegister(register);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(
      await screen.findByText("Email or username already in use"),
    ).toBeInTheDocument();
  });

  it("exposes a link back to /login", () => {
    renderRegister();
    const link = screen.getByRole("link", { name: /inici[aá] sesi[oó]n/i });
    expect(link).toHaveAttribute("href", "/login");
  });
});
