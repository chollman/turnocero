import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

// ── Mocks ────────────────────────────────────────────────────────────
let mockUser;
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));
const addToast = vi.fn();
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: () => ({ addToast }),
}));

// PlayForm stub: expone onSubmit/onCancel + lo que recibió.
vi.mock("./PlayForm", () => ({
  default: ({ onSubmit, onCancel, lockedGame, initialValues }) => (
    <div data-testid="play-form">
      <span data-testid="locked">{String(!!lockedGame)}</span>
      <span data-testid="game">{initialValues?.game?.name || ""}</span>
      <button onClick={() => onSubmit({ objectid: "13", players: [] })}>
        submit
      </button>
      <button onClick={onCancel}>cancel</button>
    </div>
  ),
}));

import CreatePlay from "./CreatePlay";

function Echo() {
  const loc = useLocation();
  return <div data-testid="echo">{loc.pathname + loc.search}</div>;
}

function renderAt(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/bg-watch/:bggUsername/partidas/nueva"
          element={<CreatePlay />}
        />
        <Route path="/bg-watch/:bggUsername" element={<Echo />} />
        <Route path="/bg-watch/:bggUsername/juego/:gameId" element={<Echo />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  addToast.mockClear();
  mockUser = {
    _id: "me",
    username: "me",
    displayName: "Me",
    bggUsername: "meBGG",
    bggConnected: true,
    bggInvalid: false,
  };
});

describe("<CreatePlay>", () => {
  it("redirige al perfil si no es el dueño", async () => {
    mockUser = { ...mockUser, bggUsername: "otro" };
    renderAt("/bg-watch/meBGG/partidas/nueva");
    await waitFor(() =>
      expect(screen.getByTestId("echo")).toHaveTextContent("/bg-watch/meBGG"),
    );
    expect(screen.queryByTestId("play-form")).toBeNull();
  });

  it("redirige si el usuario no tiene BGG conectado", async () => {
    mockUser = { ...mockUser, bggConnected: false };
    renderAt("/bg-watch/meBGG/partidas/nueva");
    await waitFor(() =>
      expect(screen.getByTestId("echo")).toHaveTextContent("/bg-watch/meBGG"),
    );
  });

  it("el dueño ve el form (sin juego prefijado)", () => {
    renderAt("/bg-watch/meBGG/partidas/nueva");
    expect(screen.getByTestId("play-form")).toBeInTheDocument();
    expect(screen.getByTestId("locked")).toHaveTextContent("false");
  });

  it("con ?juego prefija el juego (locked) tras traer sus datos", async () => {
    server.use(
      http.get("/api/bgg/game/:id", () =>
        HttpResponse.json({
          id: "13",
          name: "Catán",
          thumbnail: null,
          year: 1995,
        }),
      ),
    );
    renderAt("/bg-watch/meBGG/partidas/nueva?juego=13");
    await waitFor(() =>
      expect(screen.getByTestId("game")).toHaveTextContent("Catán"),
    );
    expect(screen.getByTestId("locked")).toHaveTextContent("true");
  });

  it("submit hace POST y navega al perfil", async () => {
    let posted = false;
    server.use(
      http.post("/api/bgg/partidas", () => {
        posted = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    renderAt("/bg-watch/meBGG/partidas/nueva");
    fireEvent.click(screen.getByRole("button", { name: "submit" }));
    await waitFor(() => expect(posted).toBe(true));
    await waitFor(() =>
      expect(screen.getByTestId("echo")).toHaveTextContent("/bg-watch/meBGG"),
    );
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    );
  });
});
