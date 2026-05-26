import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import BgWatchLanding from "./BgWatchLanding";
import { useAuth } from "../../context/AuthContext";

function setup({ user = null, loading = false } = {}) {
  useAuth.mockReturnValue({ user, loading });
  return render(
    <MemoryRouter>
      <BgWatchLanding />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateMock.mockReset();
});

describe("<BgWatchLanding>", () => {
  it("renders nothing while auth is still loading", () => {
    const { container } = setup({ loading: true });
    expect(container.firstChild).toBeNull();
  });

  it("redirects logged-in users with bggUsername to their profile", () => {
    setup({ user: { _id: "me", username: "me", bggUsername: "CarcaFan" } });
    expect(navigateMock).toHaveBeenCalledWith("/bg-watch/CarcaFan", {
      replace: true,
    });
  });

  it("shows the landing content to anonymous visitors", () => {
    setup({ user: null });
    expect(screen.getAllByText(/BG WATCH/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/registr[aá] tus partidas/i).length,
    ).toBeGreaterThan(0);
  });

  it("shows landing content to logged-in users without bggUsername", () => {
    setup({ user: { _id: "me", username: "me", bggUsername: "" } });
    expect(screen.getAllByText(/BG WATCH/i).length).toBeGreaterThan(0);
  });

  it("renders the three core feature cards", () => {
    setup({ user: null });
    expect(
      screen.getAllByText(/registr[aá] tus partidas/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/tu colecci[oó]n/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/una vista por juego/i).length).toBeGreaterThan(
      0,
    );
  });
});
