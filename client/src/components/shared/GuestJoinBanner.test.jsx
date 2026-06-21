import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouterOnly } from "../../test/wrappers/AllProviders";

const h = vi.hoisted(() => ({
  auth: { user: null, loading: false },
  brandName: "TurnoCero",
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => h.auth,
}));
vi.mock("../../hooks/useBrandName", () => ({
  useBrandName: () => h.brandName,
}));

import GuestJoinBanner from "./GuestJoinBanner";

const renderBanner = () =>
  render(<GuestJoinBanner />, { wrapper: RouterOnly });

describe("GuestJoinBanner", () => {
  beforeEach(() => {
    h.auth = { user: null, loading: false };
    h.brandName = "TurnoCero";
  });

  it("muestra la propuesta de valor y los CTAs a un visitante anónimo", () => {
    renderBanner();
    expect(screen.getByText(/Sumate a/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Encontrá gente para jugar cerca tuyo/i),
    ).toBeInTheDocument();

    const register = screen.getByRole("link", { name: /Registrate gratis/i });
    expect(register).toHaveAttribute("href", "/register");
    const login = screen.getByRole("link", { name: /Ya tengo cuenta/i });
    expect(login).toHaveAttribute("href", "/login");
  });

  it("usa el nombre de marca de la comunidad (tenant/skin)", () => {
    h.brandName = "Club Catan";
    renderBanner();
    expect(screen.getByText("Club Catan")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Sumate a Club Catan"),
    ).toBeInTheDocument();
  });

  it("conserva propuesta de valor y CTAs en la variante card (sidebar)", () => {
    render(<GuestJoinBanner variant="card" />, { wrapper: RouterOnly });
    expect(screen.getByText(/Sumate a/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Registrate gratis/i }),
    ).toHaveAttribute("href", "/register");
    expect(
      screen.getByRole("link", { name: /Ya tengo cuenta/i }),
    ).toHaveAttribute("href", "/login");
  });

  it("no renderiza nada para un usuario logueado", () => {
    h.auth = { user: { _id: "u1" }, loading: false };
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it("no renderiza nada mientras se resuelve la sesión (loading)", () => {
    h.auth = { user: null, loading: true };
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });
});
