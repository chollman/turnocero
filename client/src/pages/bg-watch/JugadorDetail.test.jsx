import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
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
vi.mock("../../components/shared/Avatar", () => ({
  default: ({ user }) => (
    <div data-testid="avatar">{user?.displayName || user?.username || ""}</div>
  ),
}));
// PlayCard / PlayDetailModal have their own tests; stub to keep this focused.
vi.mock("./PlayCard", () => ({
  default: ({ play, onClick }) => (
    <button data-testid="playcard" onClick={onClick}>
      {play.gameName}
    </button>
  ),
}));
// Modal de curación: stub que expone los tres desenlaces de onClose.
vi.mock("./PlayerEditModals", () => ({
  EditPlayerModal: ({ onClose }) => (
    <div data-testid="edit-modal">
      <button onClick={() => onClose("updated")}>stub-updated</button>
      <button onClick={() => onClose("merged")}>stub-merged</button>
      <button onClick={() => onClose(false)}>stub-close</button>
    </div>
  ),
}));

import JugadorDetail from "./JugadorDetail";

function detailResponse(extra = {}) {
  return HttpResponse.json({
    player: {
      key: "k:u:bob",
      rawKeys: ["u:bob"],
      name: "Bob",
      username: "bob",
      avatar: null,
      isSelf: false,
      isLinked: false,
      linkedUser: null,
      ...(extra.player || {}),
    },
    h2h: { ownerWins: 3, playerWins: 2, draws: 1, ...(extra.h2h || {}) },
    stats: {
      total: 6,
      firstPlayedDate: "2026-01-01",
      lastPlayedDate: "2026-03-01",
      byGame: [
        {
          gameId: "100",
          name: "Catan",
          thumbnail: null,
          total: 4,
          ownerWins: 2,
          playerWins: 1,
        },
      ],
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

function renderDetail(key = "k:u:bob") {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[`/bg-watch/alice/jugador/${key}`]}>
        <Routes>
          <Route
            path="/bg-watch/:bggUsername/jugador/:playerKey"
            element={<JugadorDetail />}
          />
          <Route
            path="/bg-watch/:bggUsername/partidas"
            element={<div data-testid="partidas-page">partidas</div>}
          />
          <Route
            path="/bg-watch/:bggUsername/jugadores"
            element={<div data-testid="jugadores-page">jugadores</div>}
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
  server.use(http.get("/api/bgg/jugadores/:user/:key", () => detailResponse()));
});

describe("<JugadorDetail>", () => {
  it("al ingresar solo muestra header y partidas; H2H/stats/por-juego detrás de un botón", async () => {
    renderDetail();
    expect((await screen.findAllByText("Bob")).length).toBeGreaterThan(0);
    // Ni el marcador H2H, ni las stats, ni "por juego" aparecen al entrar.
    expect(screen.queryByText("–")).toBeNull();
    expect(screen.queryByText("6")).toBeNull();
    expect(screen.queryByText("Catan")).toBeNull();
    // Las partidas sí.
    expect(screen.getByTestId("playcard")).toBeInTheDocument();
    // Botón para revelar.
    expect(
      screen.getByRole("button", { name: /ver mano a mano/i }),
    ).toBeInTheDocument();
  });

  it("revela el marcador H2H, las stats y por-juego al clickear el botón", async () => {
    renderDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: /ver mano a mano/i }),
    );
    // Marcador H2H (dueño 3 – jugador 2), scopeado al bloque del marcador.
    const score = screen.getByText("–").parentElement;
    expect(within(score).getByText("3")).toBeInTheDocument();
    expect(within(score).getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/1 sin decidir/)).toBeInTheDocument();
    // Stats + por juego ahora visibles.
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("Catan")).toBeInTheDocument();
    // El botón ya no está.
    expect(
      screen.queryByRole("button", { name: /ver mano a mano/i }),
    ).toBeNull();
  });

  it("lista las partidas y navega al detalle al clickear una", async () => {
    renderDetail();
    const card = await screen.findByTestId("playcard");
    fireEvent.click(card);
    expect(await screen.findByTestId("play-detail-page")).toBeInTheDocument();
  });

  it("muestra el link al H2H de comunidad solo si el jugador está vinculado", async () => {
    // No vinculado → sin link.
    renderDetail();
    await screen.findAllByText("Bob");
    expect(screen.queryByText(/mano a mano de comunidad/i)).toBeNull();

    // Vinculado → con link.
    server.use(
      http.get("/api/bgg/jugadores/:user/:key", () =>
        detailResponse({
          player: {
            isLinked: true,
            linkedUser: { _id: "u1", displayName: "Bob", username: "bob" },
          },
        }),
      ),
    );
    renderDetail();
    await waitFor(() =>
      expect(screen.getByText(/mano a mano de comunidad/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/ver perfil/i)).toBeInTheDocument();
  });

  it("muestra estado vacío cuando no hay partidas juntas", async () => {
    server.use(
      http.get("/api/bgg/jugadores/:user/:key", () =>
        detailResponse({
          total: 0,
          stats: {
            total: 0,
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
      await screen.findByText(/todavía no hay partidas tuyas/i),
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
    expect((await screen.findAllByText("Bob")).length).toBeGreaterThan(0);
  });

  it("muestra error si la carga falla", async () => {
    server.use(
      http.get("/api/bgg/jugadores/:user/:key", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderDetail();
    expect(
      await screen.findByText(/no se pudo cargar el jugador/i),
    ).toBeInTheDocument();
  });

  it("muestra 'Editar jugador' y abre el modal de curación", async () => {
    renderDetail();
    const editBtn = await screen.findByRole("button", {
      name: /editar jugador/i,
    });
    fireEvent.click(editBtn);
    expect(screen.getByTestId("edit-modal")).toBeInTheDocument();
  });

  it("no ofrece editar si el jugador está marcado como vos", async () => {
    server.use(
      http.get("/api/bgg/jugadores/:user/:key", () =>
        detailResponse({ player: { isSelf: true } }),
      ),
    );
    renderDetail();
    await screen.findAllByText("Bob");
    expect(
      screen.queryByRole("button", { name: /editar jugador/i }),
    ).toBeNull();
  });

  it("al fusionar (merged) vuelve a la lista de jugadores", async () => {
    renderDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: /editar jugador/i }),
    );
    fireEvent.click(screen.getByText("stub-merged"));
    expect(await screen.findByTestId("jugadores-page")).toBeInTheDocument();
  });

  it("al actualizar (updated) refresca el detalle", async () => {
    let calls = 0;
    server.use(
      http.get("/api/bgg/jugadores/:user/:key", () => {
        calls += 1;
        return detailResponse();
      }),
    );
    renderDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: /editar jugador/i }),
    );
    const before = calls;
    fireEvent.click(screen.getByText("stub-updated"));
    await waitFor(() => expect(calls).toBeGreaterThan(before));
  });
});
