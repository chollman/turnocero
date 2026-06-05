import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

// Heavy child components — stubbed but capture canRefresh so tests can assert
// what BgWatchProfile passed in for owner/admin gating.
vi.mock("./PartidasPanel", () => ({
  default: ({ canRefresh }) => (
    <div data-testid="partidas-panel" data-can-refresh={String(!!canRefresh)} />
  ),
}));
vi.mock("./ColeccionPanel", () => ({
  default: ({ canRefresh }) => (
    <div
      data-testid="coleccion-panel"
      data-can-refresh={String(!!canRefresh)}
    />
  ),
}));
vi.mock("./PlayDetailModal", () => ({ default: () => null }));
vi.mock("./BgWatchGuestCTAs", () => ({
  GuestBanner: () => null,
  GuestInlineCTA: () => null,
  GuestFooter: () => null,
}));
// useBggUserMap (hook): returns an empty map.
vi.mock("./useBggUserMap", () => ({ default: () => ({}) }));

import BgWatchProfile from "./BgWatchProfile";
import { useAuth } from "../../context/AuthContext";

function renderProfile({
  user = null,
  bggUsername = "someone",
  path = "",
} = {}) {
  useAuth.mockReturnValue({ user });
  return render(
    <MemoryRouter initialEntries={[`/bg-watch/${bggUsername}${path}`]}>
      <Routes>
        <Route path="/bg-watch/:bggUsername" element={<BgWatchProfile />} />
        <Route
          path="/bg-watch/:bggUsername/partidas"
          element={<BgWatchProfile />}
        />
        <Route
          path="/bg-watch/:bggUsername/coleccion"
          element={<BgWatchProfile />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

// La tab activa toggea el `display` del wrapper del panel — usamos eso para
// saber cuál está visible (ambos paneles quedan montados).
const panelVisible = (testid) =>
  screen.getByTestId(testid).parentElement.style.display !== "none";

beforeEach(() => {
  // Default MSW handlers for BGG endpoints used on mount.
  server.use(
    http.get("/api/bgg/partidas/:bggUsername", () =>
      HttpResponse.json({ partidas: [], page: 1, total: 0 }),
    ),
    http.get("/api/bgg/coleccion/:bggUsername", () => HttpResponse.json([])),
  );
});

describe("<BgWatchProfile>", () => {
  it("renders the bggUsername in the header", async () => {
    renderProfile({ bggUsername: "CarcaFan" });
    await waitFor(() => {
      expect(screen.getAllByText(/CarcaFan/i).length).toBeGreaterThan(0);
    });
  });

  it("renders Partidas tab by default", async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByTestId("partidas-panel")).toBeInTheDocument();
    });
  });

  it("switches to Coleccion when the tab is clicked (updates the URL)", async () => {
    renderProfile();
    await screen.findByTestId("partidas-panel");
    expect(panelVisible("partidas-panel")).toBe(true);
    expect(panelVisible("coleccion-panel")).toBe(false);

    const coleccionTab = screen
      .getAllByRole("button")
      .find((b) => /colecci[oó]n/i.test(b.textContent || ""));
    fireEvent.click(coleccionTab);

    await waitFor(() => expect(panelVisible("coleccion-panel")).toBe(true));
    expect(panelVisible("partidas-panel")).toBe(false);
  });

  it("lands directly on Coleccion via /bg-watch/:user/coleccion", async () => {
    renderProfile({ bggUsername: "CarcaFan", path: "/coleccion" });
    await screen.findByTestId("coleccion-panel");
    expect(panelVisible("coleccion-panel")).toBe(true);
    expect(panelVisible("partidas-panel")).toBe(false);
  });

  it("lands on Partidas via /bg-watch/:user/partidas", async () => {
    renderProfile({ bggUsername: "CarcaFan", path: "/partidas" });
    await screen.findByTestId("partidas-panel");
    expect(panelVisible("partidas-panel")).toBe(true);
    expect(panelVisible("coleccion-panel")).toBe(false);
  });

  it("passes canRefresh=true to panels when the logged-in user owns this bggUsername", async () => {
    renderProfile({
      user: {
        bggUsername: "CarcaFan",
        bggConnected: true,
        bggInvalid: false,
        isAdmin: false,
      },
      bggUsername: "CarcaFan",
    });
    const panel = await screen.findByTestId("partidas-panel");
    expect(panel.dataset.canRefresh).toBe("true");
    expect(screen.getByTestId("coleccion-panel").dataset.canRefresh).toBe(
      "true",
    );
  });

  it("passes canRefresh=false when the logged-in user does NOT own this bggUsername and is not admin", async () => {
    renderProfile({
      user: { bggUsername: "SomeoneElse", isAdmin: false },
      bggUsername: "CarcaFan",
    });
    const panel = await screen.findByTestId("partidas-panel");
    expect(panel.dataset.canRefresh).toBe("false");
    expect(screen.getByTestId("coleccion-panel").dataset.canRefresh).toBe(
      "false",
    );
  });

  it("passes canRefresh=true to admins viewing any profile (effective user.isAdmin)", async () => {
    renderProfile({
      user: { bggUsername: "SomeoneElse", isAdmin: true },
      bggUsername: "CarcaFan",
    });
    const panel = await screen.findByTestId("partidas-panel");
    expect(panel.dataset.canRefresh).toBe("true");
    expect(screen.getByTestId("coleccion-panel").dataset.canRefresh).toBe(
      "true",
    );
  });

  it('admin in "Ver como usuario" mode is treated as a non-owner (no refresh button)', async () => {
    // AuthContext sets user.isAdmin=false when the AdminViewToggle is active,
    // even though isActuallyAdmin stays true. The component must respect the
    // effective flag so the preview is faithful — no refresh on other profiles.
    renderProfile({
      user: { bggUsername: "SomeoneElse", isAdmin: false },
      bggUsername: "CarcaFan",
    });
    const panel = await screen.findByTestId("partidas-panel");
    expect(panel.dataset.canRefresh).toBe("false");
    expect(screen.getByTestId("coleccion-panel").dataset.canRefresh).toBe(
      "false",
    );
  });

  it("passes canRefresh=false to guests (no user)", async () => {
    renderProfile({ user: null, bggUsername: "CarcaFan" });
    const panel = await screen.findByTestId("partidas-panel");
    expect(panel.dataset.canRefresh).toBe("false");
  });

  it("renders StatsBar with all four metric labels", async () => {
    renderProfile();
    await waitFor(() => {
      // "Partidas" appears as both the tab label and the stat label — at least one suffices.
      expect(screen.getAllByText("Partidas").length).toBeGreaterThan(0);
      expect(screen.getByText(/juegos únicos/i)).toBeInTheDocument();
      expect(screen.getByText(/más jugado/i)).toBeInTheDocument();
      expect(screen.getByText(/última partida/i)).toBeInTheDocument();
    });
  });
});
