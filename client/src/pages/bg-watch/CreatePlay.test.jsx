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
  default: ({
    onSubmit,
    onCancel,
    lockedGame,
    initialValues,
    keepGoing,
    onKeepGoingChange,
    lastJuntada,
  }) => (
    <div data-testid="play-form">
      <span data-testid="locked">{String(!!lockedGame)}</span>
      <span data-testid="game">{initialValues?.game?.name || ""}</span>
      <span data-testid="last-juntada">
        {lastJuntada ? lastJuntada.players.map((p) => p.name).join(",") : ""}
      </span>
      <span data-testid="carry-players">
        {(initialValues?.players || []).map((p) => p.name).join(",")}
      </span>
      <span data-testid="carry-loc">
        {initialValues?.details?.location || ""}
      </span>
      {onKeepGoingChange && (
        <input
          type="checkbox"
          aria-label="keep"
          checked={!!keepGoing}
          onChange={(e) => onKeepGoingChange(e.target.checked)}
        />
      )}
      <button
        onClick={() =>
          onSubmit({
            objectid: "13",
            playdate: "2026-05-01",
            location: "Casa",
            players: [
              { name: "Me", username: "meBGG" },
              { name: "Bob", username: "bob" },
            ],
          })
        }
      >
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
        <Route path="/bg-watch/:bggUsername/coleccion" element={<Echo />} />
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

  it("trae la última juntada y se la pasa al form", async () => {
    server.use(
      http.get("/api/bgg/ultima-juntada/:user", () =>
        HttpResponse.json({
          juntada: {
            location: "Club",
            players: [
              { name: "Me", username: "meBGG" },
              { name: "Bob", username: "bob" },
            ],
          },
        }),
      ),
    );
    renderAt("/bg-watch/meBGG/partidas/nueva");
    await waitFor(() =>
      expect(screen.getByTestId("last-juntada")).toHaveTextContent("Me,Bob"),
    );
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

  it("vuelve a la tab de origen (?volver) al guardar", async () => {
    server.use(
      http.post("/api/bgg/partidas", () => HttpResponse.json({ ok: true })),
    );
    renderAt(
      `/bg-watch/meBGG/partidas/nueva?volver=${encodeURIComponent(
        "/bg-watch/meBGG/coleccion",
      )}`,
    );
    fireEvent.click(screen.getByRole("button", { name: "submit" }));
    await waitFor(() =>
      expect(screen.getByTestId("echo")).toHaveTextContent(
        "/bg-watch/meBGG/coleccion",
      ),
    );
  });

  it("ignora un ?volver externo (solo rutas de BG Watch)", async () => {
    renderAt(
      `/bg-watch/meBGG/partidas/nueva?volver=${encodeURIComponent(
        "https://evil.example",
      )}`,
    );
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    // Cae al fallback (perfil), no al destino externo.
    await waitFor(() =>
      expect(screen.getByTestId("echo")).toHaveTextContent("/bg-watch/meBGG"),
    );
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

  it("con 'cargar otra' guarda, se queda y conserva roster + ubicación", async () => {
    let posts = 0;
    server.use(
      http.post("/api/bgg/partidas", () => {
        posts += 1;
        return HttpResponse.json({ ok: true });
      }),
    );
    renderAt("/bg-watch/meBGG/partidas/nueva");
    fireEvent.click(screen.getByLabelText("keep")); // marcar "cargar otra"
    fireEvent.click(screen.getByRole("button", { name: "submit" }));
    await waitFor(() => expect(posts).toBe(1));
    // No navegó: sigue el form, y remontó con el roster + ubicación.
    expect(screen.getByTestId("play-form")).toBeInTheDocument();
    expect(screen.queryByTestId("echo")).toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId("carry-players")).toHaveTextContent("Me,Bob"),
    );
    expect(screen.getByTestId("carry-loc")).toHaveTextContent("Casa");
  });
});
