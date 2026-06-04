import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

// Register es un wrapper delgado sobre <Auth mode="register">. Las pruebas de
// comportamiento viven en Auth.test.jsx; acá sólo verificamos el modo.
vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/SiteConfigContext", () => ({ useSiteConfig: vi.fn() }));
vi.mock("../../context/CommunityContext", () => ({
  useCommunity: () => ({
    isTenant: false,
    brand: { name: "TurnoCero", tagline: "", logoLight: "", logoDark: "" },
  }),
}));
vi.mock("./OAuthButtons", () => ({ default: () => null }));

import Register from "./Register";
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

describe("<Register>", () => {
  it("renders the register mode of <Auth>", () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: /crear mi cuenta/i }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("BlackwatchGames")).toBeInTheDocument();
    // The "Iniciar sesión" toggle tab points to /login.
    const loginTab = screen
      .getAllByRole("tab")
      .find((t) => t.textContent === "Iniciar sesión");
    expect(loginTab).toHaveAttribute("href", "/login");
  });
});
