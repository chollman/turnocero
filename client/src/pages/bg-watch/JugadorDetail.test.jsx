import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

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
vi.mock("./PlayDetailModal", () => ({
  default: ({ play, onClose }) => (
    <div data-testid="play-modal">
      {play.gameName}
      <button onClick={onClose}>cerrar</button>
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
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockUser = { _id: "me", username: "alice", bggUsername: "alice" };
  server.use(http.get("/api/bgg/jugadores/:user/:key", () => detailResponse()));
});

describe("<JugadorDetail>", () => {
  it("muestra header y stats al ingresar, con el H2H detrás de un botón", async () => {
    renderDetail();
    expect((await screen.findAllByText("Bob")).length).toBeGreaterThan(0);
    // El marcador H2H NO aparece al entrar.
    expect(screen.queryByText("–")).toBeNull();
    // Stat: total de partidas juntas (valor único).
    expect(screen.getByText("6")).toBeInTheDocument();
    // Por juego.
    expect(screen.getByText("Catan")).toBeInTheDocument();
    // Botón para revelar el H2H.
    expect(
      screen.getByRole("button", { name: /ver mano a mano/i }),
    ).toBeInTheDocument();
  });

  it("revela el marcador H2H al clickear el botón", async () => {
    renderDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: /ver mano a mano/i }),
    );
    // Marcador H2H (dueño 3 – jugador 2), scopeado al bloque del marcador.
    const score = screen.getByText("–").parentElement;
    expect(within(score).getByText("3")).toBeInTheDocument();
    expect(within(score).getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/1 sin decidir/)).toBeInTheDocument();
    // El botón ya no está.
    expect(
      screen.queryByRole("button", { name: /ver mano a mano/i }),
    ).toBeNull();
  });

  it("lista las partidas y abre el modal al clickear una", async () => {
    renderDetail();
    const card = await screen.findByTestId("playcard");
    fireEvent.click(card);
    expect(await screen.findByTestId("play-modal")).toBeInTheDocument();
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
});
