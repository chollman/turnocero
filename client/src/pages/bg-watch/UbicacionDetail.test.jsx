import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
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

let mockUser;
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));
vi.mock("./PlayCard", () => ({
  default: ({ play, onClick }) => (
    <button data-testid="playcard" onClick={onClick}>
      {play.gameName}
    </button>
  ),
}));
// Modal de curación: stub que expone los desenlaces de onClose.
vi.mock("./LocationEditModals", () => ({
  EditLocationModal: ({ onClose }) => (
    <div data-testid="edit-modal">
      <button onClick={() => onClose("updated")}>stub-updated</button>
      <button onClick={() => onClose("merged")}>stub-merged</button>
      <button onClick={() => onClose(false)}>stub-close</button>
    </div>
  ),
}));

import UbicacionDetail from "./UbicacionDetail";

function detailResponse(extra = {}) {
  return HttpResponse.json({
    location: {
      key: "k:l:casa",
      rawKeys: ["l:casa"],
      name: "Casa",
      ...(extra.location || {}),
    },
    stats: {
      total: 6,
      uniqueGames: 2,
      firstPlayedDate: "2026-01-01",
      lastPlayedDate: "2026-03-01",
      byGame: [{ gameId: "100", name: "Catan", thumbnail: null, total: 4 }],
      ...(extra.stats || {}),
    },
    plays: extra.plays || [
      { id: "p1", gameName: "Carcassonne", date: "2026-03-01", players: [] },
    ],
    page: 1,
    total: extra.total ?? 6,
    pageSize: 10,
  });
}

function renderDetail(key = "k:l:casa") {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[`/bg-watch/alice/ubicacion/${key}`]}>
        <Routes>
          <Route
            path="/bg-watch/:bggUsername/ubicacion/:locationKey"
            element={<UbicacionDetail />}
          />
          <Route
            path="/bg-watch/:bggUsername/partidas"
            element={<div data-testid="partidas-page">partidas</div>}
          />
          <Route
            path="/bg-watch/:bggUsername/ubicaciones"
            element={<div data-testid="ubicaciones-page">ubicaciones</div>}
          />
          <Route
            path="/bg-watch/:bggUsername/partidas/:playId"
            element={<div data-testid="play-detail-page">detalle</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockUser = { _id: "me", username: "alice", bggUsername: "alice" };
  server.use(
    http.get("/api/bgg/ubicaciones/:user/:key", () => detailResponse()),
  );
});

describe("<UbicacionDetail>", () => {
  it("muestra el nombre, las stats y las partidas", async () => {
    renderDetail();
    expect((await screen.findAllByText(/Casa/)).length).toBeGreaterThan(0);
    expect(screen.getByText("6")).toBeInTheDocument(); // partidas acá
    expect(screen.getByText("2")).toBeInTheDocument(); // juegos distintos
    expect(screen.getByText("Catan")).toBeInTheDocument(); // por juego
    expect(screen.getByTestId("playcard")).toBeInTheDocument();
  });

  it("navega al detalle de partida al clickear una", async () => {
    renderDetail();
    fireEvent.click(await screen.findByTestId("playcard"));
    expect(await screen.findByTestId("play-detail-page")).toBeInTheDocument();
  });

  it("muestra estado vacío cuando no hay partidas en la ubicación", async () => {
    server.use(
      http.get("/api/bgg/ubicaciones/:user/:key", () =>
        detailResponse({
          total: 0,
          stats: {
            total: 0,
            uniqueGames: 0,
            byGame: [],
            firstPlayedDate: null,
            lastPlayedDate: null,
          },
          plays: [],
        }),
      ),
    );
    renderDetail();
    expect(
      await screen.findByText(
        /todavía no hay partidas tuyas en esta ubicación/i,
      ),
    ).toBeInTheDocument();
  });

  it("redirige a partidas si el visitante no es dueño ni admin", async () => {
    mockUser = { _id: "x", username: "carol", bggUsername: "carol" };
    renderDetail();
    expect(await screen.findByTestId("partidas-page")).toBeInTheDocument();
  });

  it("permite a un admin ver el detalle de otro perfil", async () => {
    mockUser = {
      _id: "x",
      username: "carol",
      bggUsername: "carol",
      isAdmin: true,
    };
    renderDetail();
    expect((await screen.findAllByText(/Casa/)).length).toBeGreaterThan(0);
  });

  it("muestra error si la carga falla", async () => {
    server.use(
      http.get("/api/bgg/ubicaciones/:user/:key", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderDetail();
    expect(
      await screen.findByText(/no se pudo cargar la ubicación/i),
    ).toBeInTheDocument();
  });

  it("'Editar ubicación' abre el modal de curación", async () => {
    renderDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: /editar ubicación/i }),
    );
    expect(screen.getByTestId("edit-modal")).toBeInTheDocument();
  });

  it("al fusionar (merged) vuelve a la lista de ubicaciones", async () => {
    renderDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: /editar ubicación/i }),
    );
    fireEvent.click(screen.getByText("stub-merged"));
    expect(await screen.findByTestId("ubicaciones-page")).toBeInTheDocument();
  });

  it("al actualizar (updated) refresca el detalle", async () => {
    let calls = 0;
    server.use(
      http.get("/api/bgg/ubicaciones/:user/:key", () => {
        calls += 1;
        return detailResponse();
      }),
    );
    renderDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: /editar ubicación/i }),
    );
    const before = calls;
    fireEvent.click(screen.getByText("stub-updated"));
    await waitFor(() => expect(calls).toBeGreaterThan(before));
  });
});
