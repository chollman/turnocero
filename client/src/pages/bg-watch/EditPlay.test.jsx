import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
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
const addToast = vi.fn();
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: () => ({ addToast }),
}));

vi.mock("./PlayForm", () => ({
  default: ({ onSubmit, onDelete, editMode, initialValues }) => (
    <div data-testid="play-form">
      <span data-testid="edit">{String(!!editMode)}</span>
      <span data-testid="game">{initialValues?.game?.name || ""}</span>
      <button onClick={() => onSubmit({ objectid: "13", players: [] })}>
        submit
      </button>
      {onDelete && <button onClick={onDelete}>delete</button>}
    </div>
  ),
}));

import EditPlay from "./EditPlay";

function Echo() {
  const loc = useLocation();
  return <div data-testid="echo">{loc.pathname}</div>;
}

function renderAt(entry) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/bg-watch/:bggUsername/partidas/:playId/editar"
            element={<EditPlay />}
          />
          <Route path="/bg-watch/:bggUsername" element={<Echo />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const STATE_PLAY = {
  id: "p1",
  gameId: "13",
  gameName: "Catán (state)",
  date: "2026-05-01",
  players: [{ name: "X", username: "", win: false, new: false }],
};

beforeEach(() => {
  addToast.mockClear();
  mockUser = {
    _id: "me",
    username: "me",
    bggUsername: "meBGG",
    bggConnected: true,
    bggInvalid: false,
  };
});

describe("<EditPlay>", () => {
  it("precarga desde location.state.play (fast-path)", () => {
    renderAt({
      pathname: "/bg-watch/meBGG/partidas/p1/editar",
      state: { play: STATE_PLAY },
    });
    expect(screen.getByTestId("edit")).toHaveTextContent("true");
    expect(screen.getByTestId("game")).toHaveTextContent("Catán (state)");
  });

  it("precarga vía endpoint cuando no hay state", async () => {
    server.use(
      http.get("/api/bgg/partida/:user/:playId", () =>
        HttpResponse.json({
          id: "p1",
          gameId: "13",
          gameName: "Catán (fetch)",
          date: "2026-05-01",
          players: [],
        }),
      ),
    );
    renderAt("/bg-watch/meBGG/partidas/p1/editar");
    await waitFor(() =>
      expect(screen.getByTestId("game")).toHaveTextContent("Catán (fetch)"),
    );
  });

  it("redirige si no es el dueño", async () => {
    mockUser = { ...mockUser, bggUsername: "otro" };
    renderAt({
      pathname: "/bg-watch/meBGG/partidas/p1/editar",
      state: { play: STATE_PLAY },
    });
    await waitFor(() =>
      expect(screen.getByTestId("echo")).toHaveTextContent("/bg-watch/meBGG"),
    );
  });

  it("submit hace PUT y navega", async () => {
    let putCalled = false;
    server.use(
      http.put("/api/bgg/partidas/:id", () => {
        putCalled = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    renderAt({
      pathname: "/bg-watch/meBGG/partidas/p1/editar",
      state: { play: STATE_PLAY },
    });
    fireEvent.click(screen.getByRole("button", { name: "submit" }));
    await waitFor(() => expect(putCalled).toBe(true));
    await waitFor(() =>
      expect(screen.getByTestId("echo")).toHaveTextContent("/bg-watch/meBGG"),
    );
  });

  it("delete confirma, hace DELETE y navega", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let delCalled = false;
    server.use(
      http.delete("/api/bgg/partidas/:id", () => {
        delCalled = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    renderAt({
      pathname: "/bg-watch/meBGG/partidas/p1/editar",
      state: { play: STATE_PLAY },
    });
    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    await waitFor(() => expect(delCalled).toBe(true));
    await waitFor(() =>
      expect(screen.getByTestId("echo")).toHaveTextContent("/bg-watch/meBGG"),
    );
    window.confirm.mockRestore();
  });
});
