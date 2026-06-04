import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

// Login es un wrapper delgado sobre <Auth mode="login">. Las pruebas de
// comportamiento viven en Auth.test.jsx; acá sólo verificamos que monta el
// modo correcto.
vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/SiteConfigContext", () => ({ useSiteConfig: vi.fn() }));
vi.mock("../../context/CommunityContext", () => ({
  useCommunity: () => ({
    isTenant: false,
    brand: { name: "TurnoCero", tagline: "", logoLight: "", logoDark: "" },
  }),
}));
vi.mock("./OAuthButtons", () => ({ default: () => null }));

import Login from "./Login";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";

beforeEach(() => {
  server.use(
    http.get("/api/tables/showcase", () =>
      HttpResponse.json({ total: 0, table: null }),
    ),
  );
  useAuth.mockReturnValue({ login: vi.fn(), register: vi.fn() });
  useSiteConfig.mockReturnValue({ loaded: true, isSectionEnabled: () => true });
});

describe("<Login>", () => {
  it("renders the login mode of <Auth>", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("tu@email.com")).toBeInTheDocument();
    // The "Crear cuenta" toggle tab points to /register.
    const registerTab = screen
      .getAllByRole("tab")
      .find((t) => t.textContent === "Crear cuenta");
    expect(registerTab).toHaveAttribute("href", "/register");
  });
});
