import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import ComunidadJuegoDetail from "./ComunidadJuegoDetail";

const user = {
  _id: "u1",
  username: "alice",
  displayName: "Alicia",
  avatar: {},
};

beforeEach(() => {
  server.use(
    http.get("/api/bgg/comunidad/juego/:gameId", () =>
      HttpResponse.json({
        game: { id: 100, name: "Catan", image: "", year: 1995 },
        stats: {
          totalPlays: 8,
          memberCount: 3,
          winRate: 0.5,
          avgDuration: 70,
          avgScore: 8.2,
          topPlayers: [{ bggUsername: "alice", numPlays: 5, user }],
        },
        owners: [{ bggUsername: "alice", user }],
      }),
    ),
  );
});

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/bg-watch/comunidad/juego/100"]}>
      <Routes>
        <Route
          path="/bg-watch/comunidad/juego/:gameId"
          element={<ComunidadJuegoDetail />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("<ComunidadJuegoDetail>", () => {
  it("muestra stats de comunidad, win-rate y dueños", async () => {
    renderDetail();
    expect(
      await screen.findByRole("heading", { name: "Catan" }),
    ).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument(); // winRate
    expect(screen.getByText("8")).toBeInTheDocument(); // totalPlays
    expect(screen.getByText("¿Quién lo tiene?")).toBeInTheDocument();
    expect(screen.getByText("Armar una mesa")).toBeInTheDocument();
    // alice aparece tanto en topPlayers como en owners.
    expect(screen.getAllByText("Alicia").length).toBeGreaterThanOrEqual(1);
  });
});
