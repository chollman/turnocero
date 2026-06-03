import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/SiteConfigContext", () => ({ useSiteConfig: vi.fn() }));
// OAuthButtons tiene su propio test; lo stubeamos para no arrastrar sus
// dependencias (GoogleOAuthProvider/ThemeProvider) al render de Auth.
vi.mock("./OAuthButtons", () => ({ default: () => null }));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import Auth from "./Auth";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";

let showcaseRequestCount;

beforeEach(() => {
  navigateMock.mockReset();
  showcaseRequestCount = 0;
  server.use(
    http.get("/api/tables/showcase", () => {
      showcaseRequestCount += 1;
      return HttpResponse.json({ total: 0, table: null });
    }),
  );
  useSiteConfig.mockReturnValue({
    loaded: true,
    isSectionEnabled: (key) => key === "mesas",
  });
});

function renderAuth(mode, auth = {}) {
  useAuth.mockReturnValue({ login: vi.fn(), register: vi.fn(), ...auth });
  return render(
    <MemoryRouter>
      <Auth mode={mode} />
    </MemoryRouter>,
  );
}

describe("<Auth> — login mode", () => {
  it("renders identifier + password fields and the submit button", () => {
    renderAuth("login");
    expect(screen.getByPlaceholderText("tu@email.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });

  it("calls login(identifier, password) and navigates to /", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    renderAuth("login", { login });

    fireEvent.change(screen.getByPlaceholderText("tu@email.com"), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "Password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith("a@b.com", "Password123"),
    );
    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("redirects to /verificar-email on 403 email_not_verified", async () => {
    const login = vi.fn().mockRejectedValue({
      response: {
        data: { code: "email_not_verified", email: "unv@b.com" },
        status: 403,
      },
    });
    renderAuth("login", { login });

    fireEvent.change(screen.getByPlaceholderText("tu@email.com"), {
      target: { value: "unv@b.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith(
        "/verificar-email",
        expect.objectContaining({
          state: expect.objectContaining({ email: "unv@b.com" }),
        }),
      ),
    );
  });

  it("shows the API error message on a generic failure", async () => {
    const login = vi.fn().mockRejectedValue({
      response: { data: { message: "Invalid email or password" }, status: 401 },
    });
    renderAuth("login", { login });

    fireEvent.change(screen.getByPlaceholderText("tu@email.com"), {
      target: { value: "x@y.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    expect(
      await screen.findByText("Invalid email or password"),
    ).toBeInTheDocument();
  });

  it("shows a banned message from sessionStorage and clears it", () => {
    sessionStorage.setItem("bannedMessage", "Tu cuenta fue suspendida");
    renderAuth("login");
    expect(screen.getByText("Tu cuenta fue suspendida")).toBeInTheDocument();
    expect(sessionStorage.getItem("bannedMessage")).toBeNull();
  });

  it("shows a flash message from sessionStorage and clears it", () => {
    sessionStorage.setItem("flashMessage", "Contraseña actualizada");
    renderAuth("login");
    expect(screen.getByText("Contraseña actualizada")).toBeInTheDocument();
    expect(sessionStorage.getItem("flashMessage")).toBeNull();
  });

  it("exposes the forgot-password link", () => {
    renderAuth("login");
    expect(screen.getByRole("link", { name: /olvidaste/i })).toHaveAttribute(
      "href",
      "/recuperar-contrasenia",
    );
  });

  it("skips the showcase request when the mesas section is disabled", async () => {
    useSiteConfig.mockReturnValue({ loaded: true, isSectionEnabled: () => false });
    renderAuth("login");
    await new Promise((r) => setTimeout(r, 20));
    expect(showcaseRequestCount).toBe(0);
  });

  it("does not fetch the showcase until site config is loaded", async () => {
    useSiteConfig.mockReturnValue({ loaded: false, isSectionEnabled: () => true });
    renderAuth("login");
    await new Promise((r) => setTimeout(r, 20));
    expect(showcaseRequestCount).toBe(0);
  });

  it("fetches the showcase when the mesas section is enabled", async () => {
    renderAuth("login");
    await waitFor(() => expect(showcaseRequestCount).toBe(1));
  });
});

describe("<Auth> — register mode", () => {
  function fillValidRegister({ password = "Password123" } = {}) {
    fireEvent.change(screen.getByPlaceholderText("BlackwatchGames"), {
      target: { value: "camir" },
    });
    fireEvent.change(screen.getByPlaceholderText("tu@email.com"), {
      target: { value: "new@b.com" },
    });
    fireEvent.change(
      screen.getByPlaceholderText(
        "Mín. 8 caracteres, 1 mayúscula y 1 número",
      ),
      { target: { value: password } },
    );
  }

  it("renders the register fields (no display name — set later in /perfil)", () => {
    renderAuth("register");
    expect(screen.queryByPlaceholderText("Cami Rossi")).toBeNull();
    expect(screen.getByPlaceholderText("BlackwatchGames")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("tu@email.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /crear mi cuenta/i }),
    ).toBeInTheDocument();
  });

  it("keeps the submit disabled until the form is complete + terms accepted", () => {
    renderAuth("register");
    const submit = screen.getByRole("button", { name: /crear mi cuenta/i });
    expect(submit).toBeDisabled();
    fillValidRegister();
    // Still disabled: terms not accepted yet.
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(submit).toBeEnabled();
  });

  it("keeps the submit disabled when the password fails complexity", () => {
    renderAuth("register");
    fillValidRegister({ password: "weakpass" });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(
      screen.getByRole("button", { name: /crear mi cuenta/i }),
    ).toBeDisabled();
  });

  it("shows a live password strength meter while typing", () => {
    renderAuth("register");
    fireEvent.change(
      screen.getByPlaceholderText(
        "Mín. 8 caracteres, 1 mayúscula y 1 número",
      ),
      { target: { value: "Password123!" } },
    );
    expect(screen.getByText(/Seguridad: Fuerte/)).toBeInTheDocument();
  });

  it("registers with the chosen avatarColor (no displayName) and navigates to verify", async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    renderAuth("register", { register });
    fillValidRegister();
    fireEvent.click(screen.getByLabelText("Color green"));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /crear mi cuenta/i }));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith("camir", "new@b.com", "Password123", {
        avatarColor: "--green",
      }),
    );
    expect(navigateMock).toHaveBeenCalledWith(
      "/verificar-email",
      expect.objectContaining({
        state: expect.objectContaining({ email: "new@b.com" }),
      }),
    );
  });

  it("shows the API error when register() rejects", async () => {
    const register = vi.fn().mockRejectedValue({
      response: { data: { message: "Email or username already in use" } },
    });
    renderAuth("register", { register });
    fillValidRegister();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /crear mi cuenta/i }));

    expect(
      await screen.findByText("Email or username already in use"),
    ).toBeInTheDocument();
  });

  it("sanitizes the username to lowercase without spaces", () => {
    renderAuth("register");
    const input = screen.getByPlaceholderText("BlackwatchGames");
    fireEvent.change(input, { target: { value: "Cami Rossi" } });
    expect(input.value).toBe("camirossi");
  });
});

describe("<Auth> — toggle", () => {
  it("links the segmented toggle to both routes", () => {
    renderAuth("login");
    const tabs = screen.getAllByRole("tab");
    const login = tabs.find((t) => t.textContent === "Iniciar sesión");
    const register = tabs.find((t) => t.textContent === "Crear cuenta");
    expect(login).toHaveAttribute("href", "/login");
    expect(register).toHaveAttribute("href", "/register");
    expect(login).toHaveAttribute("aria-selected", "true");
  });
});
