import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import BgWatchH2H from "./BgWatchH2H";

const alice = {
  _id: "a",
  username: "alice",
  displayName: "Alicia",
  avatar: {},
};
const bob = { _id: "b", username: "bob", displayName: "Bobby", avatar: {} };

function renderH2H() {
  return render(
    <MemoryRouter initialEntries={["/bg-watch/comunidad/h2h/alice/bob"]}>
      <Routes>
        <Route
          path="/bg-watch/comunidad/h2h/:userA/:userB"
          element={<BgWatchH2H />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("<BgWatchH2H>", () => {
  it("muestra el marcador y el desglose por juego", async () => {
    server.use(
      http.get("/api/bgg/comunidad/h2h/:a/:b", () =>
        HttpResponse.json({
          total: 3,
          aWins: 2,
          bWins: 1,
          draws: 0,
          userA: { bggUsername: "alice", user: alice },
          userB: { bggUsername: "bob", user: bob },
          byGame: [
            { gameId: "100", name: "Catan", total: 3, aWins: 2, bWins: 1 },
          ],
        }),
      ),
    );
    renderH2H();
    expect(
      await screen.findByRole("heading", { name: /Alicia vs Bobby/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Por juego")).toBeInTheDocument();
    expect(screen.getByText("Catan")).toBeInTheDocument();
  });

  it("muestra mensaje cuando no compartieron partidas", async () => {
    server.use(
      http.get("/api/bgg/comunidad/h2h/:a/:b", () =>
        HttpResponse.json({
          total: 0,
          aWins: 0,
          bWins: 0,
          draws: 0,
          userA: { bggUsername: "alice", user: alice },
          userB: { bggUsername: "bob", user: bob },
          byGame: [],
        }),
      ),
    );
    renderH2H();
    expect(
      await screen.findByText(/no compartieron ninguna partida/i),
    ).toBeInTheDocument();
  });
});
