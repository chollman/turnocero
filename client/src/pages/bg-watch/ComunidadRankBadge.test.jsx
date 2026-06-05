import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import ComunidadRankBadge from "./ComunidadRankBadge";

function renderBadge() {
  return render(
    <MemoryRouter>
      <ComunidadRankBadge bggUsername="alice" gameId="100" />
    </MemoryRouter>,
  );
}

describe("<ComunidadRankBadge>", () => {
  it("muestra el rank cuando hay más de un jugador", async () => {
    server.use(
      http.get("/api/bgg/comunidad/rank/:user/:gameId", () =>
        HttpResponse.json({ rank: { rank: 3, total: 12, numPlays: 4 } }),
      ),
    );
    renderBadge();
    expect(await screen.findByText("#3")).toBeInTheDocument();
    expect(screen.getByText(/de 12 en la comunidad/i)).toBeInTheDocument();
  });

  it("no renderiza nada si el usuario está solo (total <= 1)", async () => {
    server.use(
      http.get("/api/bgg/comunidad/rank/:user/:gameId", () =>
        HttpResponse.json({ rank: { rank: 1, total: 1, numPlays: 2 } }),
      ),
    );
    const { container } = renderBadge();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("no renderiza nada si rank es null", async () => {
    server.use(
      http.get("/api/bgg/comunidad/rank/:user/:gameId", () =>
        HttpResponse.json({ rank: null }),
      ),
    );
    const { container } = renderBadge();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
