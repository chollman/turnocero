import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

vi.mock("./PlayCard", () => ({
  default: ({ play }) => <div data-testid="play-card">{play.id}</div>,
}));
vi.mock("./PlayDetailModal", () => ({ default: () => null }));
vi.mock("./Pagination", () => ({ default: () => null }));
vi.mock("./BgWatchGuestCTAs", () => ({
  GuestBanner: () => null,
  GuestFooter: () => null,
}));
vi.mock("./useBggUserMap", () => ({ default: () => ({}) }));
// Rank badge hace su propio fetch a /comunidad/rank: stub para aislar la vista.
vi.mock("./ComunidadRankBadge", () => ({ default: () => null }));

import BgWatchPerGameView from "./BgWatchPerGameView";
import { useAuth } from "../../context/AuthContext";

function renderView({
  user = null,
  bggUsername = "CarcaFan",
  gameId = "13",
} = {}) {
  useAuth.mockReturnValue({ user });
  return render(
    <MemoryRouter initialEntries={[`/bg-watch/${bggUsername}/juego/${gameId}`]}>
      <Routes>
        <Route
          path="/bg-watch/:bggUsername/juego/:gameId"
          element={<BgWatchPerGameView />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

const GAME = {
  id: 13,
  name: "Catán",
  year: 1995,
  image: null,
  thumbnail: null,
};

beforeEach(() => {
  server.use(
    http.get("/api/bgg/game/:id", () => HttpResponse.json(GAME)),
    http.get("/api/bgg/partidas/:bggUsername", () =>
      HttpResponse.json({ plays: [], page: 1, total: 0, totalPages: 1 }),
    ),
  );
});

describe("<BgWatchPerGameView>", () => {
  it("renders the game name once loaded", async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getAllByText(/Catán/).length).toBeGreaterThan(0);
    });
  });

  it("renders one PlayCard per play returned by the API", async () => {
    server.use(
      http.get("/api/bgg/partidas/:bggUsername", () =>
        HttpResponse.json({
          plays: [
            { id: "p1", date: "2026-05-01", players: [] },
            { id: "p2", date: "2026-05-02", players: [] },
          ],
          page: 1,
          total: 2,
          totalPages: 1,
        }),
      ),
    );
    renderView();
    await waitFor(() => {
      expect(screen.getAllByTestId("play-card").length).toBe(2);
    });
  });

  it("shows a not-found title when /game/:id fails", async () => {
    server.use(
      http.get("/api/bgg/game/:id", () =>
        HttpResponse.json(
          { message: "No se pudo cargar el juego" },
          { status: 500 },
        ),
      ),
    );
    renderView();
    await waitFor(() => {
      expect(screen.getByText(/juego no encontrado/i)).toBeInTheDocument();
    });
  });

  it('shows the "Registrar partida" CTA when the user owns this BGG profile and is connected', async () => {
    renderView({
      user: {
        _id: "me",
        username: "me",
        bggUsername: "CarcaFan",
        bggConnected: true,
        bggInvalid: false,
      },
      bggUsername: "CarcaFan",
    });
    await screen.findAllByText(/Catán/);
    expect(
      screen.getByRole("button", {
        name: /registrar partida|cargar partida|nueva partida|\+ partida/i,
      }),
    ).toBeInTheDocument();
  });

  it("does NOT show the CTA when viewing someone else's profile", async () => {
    renderView({
      user: {
        _id: "me",
        username: "me",
        bggUsername: "OtroUser",
        bggConnected: true,
      },
      bggUsername: "CarcaFan",
    });
    await screen.findAllByText(/Catán/);
    expect(
      screen.queryByRole("button", {
        name: /registrar partida|cargar partida|nueva partida|\+ partida/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("uses server-aggregated gameStats over the full history when present", async () => {
    server.use(
      http.get("/api/bgg/partidas/:bggUsername", () =>
        HttpResponse.json({
          plays: [{ id: "p1", date: "2026-05-01", players: [] }],
          page: 1,
          total: 47, // many more plays exist than just the current page
          totalPages: 5,
          gameStats: {
            wins: 30,
            rated: 47,
            avgDuration: 85,
            lastDate: "2026-05-19",
          },
        }),
      ),
    );
    renderView();
    await waitFor(() => {
      // Win rate from server: 30/47 = 63.83% → rounded to 64%
      expect(screen.getByText("64%")).toBeInTheDocument();
    });
    expect(screen.getByText("85m")).toBeInTheDocument(); // server avg
    // No "de últimas N" hint when stats come from the server.
    expect(screen.queryByText(/de últimas/i)).not.toBeInTheDocument();
  });

  it("falls back to page-derived stats with partial hint when gameStats is absent", async () => {
    // Server response without gameStats (e.g. user not synced into BggPlay
    // yet, served from the BGG XML cache fallback).
    server.use(
      http.get("/api/bgg/partidas/:bggUsername", () =>
        HttpResponse.json({
          plays: [
            {
              id: "p1",
              date: "2026-05-01",
              duration: 60,
              players: [{ username: "CarcaFan", win: true }],
            },
            {
              id: "p2",
              date: "2026-05-02",
              duration: 90,
              players: [{ username: "CarcaFan", win: false }],
            },
          ],
          page: 1,
          total: 50, // many more than the 2 we sampled → partial
          totalPages: 25,
        }),
      ),
    );
    renderView();
    await waitFor(() => {
      // Win rate from the 2 sampled plays: 1/2 = 50%
      expect(screen.getByText("50%")).toBeInTheDocument();
    });
    expect(screen.getByText("75m")).toBeInTheDocument(); // (60+90)/2
    expect(screen.getAllByText(/de últimas/i).length).toBeGreaterThan(0);
  });
});
