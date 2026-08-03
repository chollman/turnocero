import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

vi.mock("./ResenaCard", () => ({
  default: ({ post }) => (
    <div data-testid="resena-card">{post.title || post.body}</div>
  ),
}));
vi.mock("./CompartidasSidebar", () => ({ default: () => null }));

import ReviewsByGame from "./ReviewsByGame";

function setup(payload, { status = 200, bggId = "13" } = {}) {
  server.use(
    http.get("/api/compartidas/juego/:bggId", () =>
      status === 200
        ? HttpResponse.json(payload)
        : HttpResponse.json({ message: "x" }, { status }),
    ),
  );
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <HelmetProvider>
        <MemoryRouter initialEntries={[`/compartidas/juego/${bggId}`]}>
          <Routes>
            <Route
              path="/compartidas/juego/:bggId"
              element={<ReviewsByGame />}
            />
            <Route path="/compartidas" element={<div>feed</div>} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
}

const GAME = { bggId: 13, name: "Catan", thumbnail: "", image: "", year: 1995 };

describe("<ReviewsByGame>", () => {
  it("muestra el encabezado del juego (nombre, promedio, conteo) y las reseñas", async () => {
    setup({
      game: GAME,
      avgRating: 7.5,
      total: 2,
      page: 1,
      pages: 1,
      reviews: [
        { _id: "r1", title: "Genial", category: "resena" },
        { _id: "r2", title: "Buenardo", category: "resena" },
      ],
    });

    expect(await screen.findByText("Catan")).toBeInTheDocument();
    expect(screen.getByText("7.5")).toBeInTheDocument();
    expect(screen.getByText("2 reseñas")).toBeInTheDocument();
    expect(screen.getAllByTestId("resena-card")).toHaveLength(2);
  });

  it("muestra un estado vacío cuando el juego no tiene reseñas", async () => {
    setup({
      game: GAME,
      avgRating: null,
      total: 0,
      page: 1,
      pages: 1,
      reviews: [],
    });

    expect(await screen.findByText(/todav[ií]a nadie rese/i)).toBeInTheDocument();
    expect(screen.queryByTestId("resena-card")).not.toBeInTheDocument();
  });

  it("muestra un error si el juego no existe (404)", async () => {
    setup(null, { status: 404 });
    expect(
      await screen.findByText(/no encontramos ese juego/i),
    ).toBeInTheDocument();
  });
});
