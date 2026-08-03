import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

let mockUser;
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));
const addToast = vi.fn();
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: () => ({ addToast }),
}));
vi.mock("../../components/shared/Avatar", () => ({
  default: ({ user }) => (
    <div data-testid="avatar">{user?.displayName || user?.username || ""}</div>
  ),
}));
vi.mock("./useBggUserMap", () => ({ default: () => ({}) }));
// El panel de grupo tiene sus propios tests; stub para aislar la página.
vi.mock("./GroupStatsPanel", () => ({
  default: () => <div data-testid="group-panel" />,
}));
// El short link real postea a /api/shortlinks; acá no nos interesa.
vi.mock("../../hooks/useShortLink", () => ({
  useShortLink: () => ({ shortUrl: null, prime: vi.fn() }),
}));
vi.mock("../error/NotFound", () => ({
  default: () => <div data-testid="not-found" />,
}));

import PlayDetail, { gameInitials } from "./PlayDetail";

const BASE_PLAY = {
  id: "777",
  date: "2026-06-01",
  gameId: "9100",
  gameName: "Brass: Birmingham",
  gameThumbnail: "https://cf/thumb.jpg",
  quantity: 1,
  duration: 120,
  location: "Casa de Cami",
  incomplete: false,
  nowinstats: false,
  comments: "Partidón.",
  players: [
    {
      name: "Claudio",
      username: "claudio",
      position: "2",
      color: "rojo",
      score: "76",
      win: false,
      new: false,
      rating: null,
    },
    {
      name: "Cami",
      username: "cami",
      position: "1",
      color: "azul",
      score: "92",
      win: true,
      new: true,
      rating: 8,
    },
  ],
};

function stubDetalle(overrides = {}) {
  const body = {
    play: { ...BASE_PLAY, ...(overrides.play || {}) },
    game:
      "game" in overrides
        ? overrides.game
        : {
            id: 9100,
            name: "Brass: Birmingham",
            image: "https://cf/image-big.jpg",
            thumbnail: "https://cf/thumb.jpg",
            year: 2018,
          },
  };
  server.use(
    http.get("/api/bgg/partida/:user/:playId/detalle", () =>
      HttpResponse.json(body),
    ),
  );
}

function renderDetail(path = "/bg-watch/claudio/partidas/777") {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <HelmetProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="/bg-watch/:bggUsername/partidas/:playId"
              element={<PlayDetail />}
            />
            <Route
              path="/bg-watch/:bggUsername/partidas"
              element={<div data-testid="partidas-page" />}
            />
            <Route
              path="/bg-watch/:bggUsername/partidas/:playId/editar"
              element={<div data-testid="edit-page" />}
            />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockUser = null;
  addToast.mockClear();
  stubDetalle();
});

describe("gameInitials", () => {
  it("usa las iniciales de las 2 primeras palabras", () => {
    expect(gameInitials("Brass: Birmingham")).toBe("BB");
  });
  it("usa las 2 primeras letras si es una sola palabra", () => {
    expect(gameInitials("Wingspan")).toBe("WI");
  });
  it("cae a ?? sin nombre", () => {
    expect(gameInitials("")).toBe("??");
  });
});

describe("<PlayDetail>", () => {
  it("muestra el hero con la tapa grande, juego y pills de meta", async () => {
    renderDetail();
    expect(
      await screen.findByRole("heading", { name: "Brass: Birmingham" }),
    ).toBeInTheDocument();
    // Imagen grande del juego (BggGame.image, no el thumbnail de la play).
    const img = screen.getByAltText("Brass: Birmingham");
    expect(img).toHaveAttribute("src", "https://cf/image-big.jpg");
    expect(screen.getByText(/Casa de Cami/)).toBeInTheDocument();
    expect(screen.getByText(/120 min/)).toBeInTheDocument();
    expect(screen.getByText(/2 jugadores/)).toBeInTheDocument();
    // Links al juego.
    expect(screen.getByText(/Ver juego en BG Watch/)).toBeInTheDocument();
    expect(screen.getByText(/Ver en BoardGameGeek/)).toBeInTheDocument();
  });

  it("sin imagen cae a las iniciales del juego", async () => {
    stubDetalle({ game: null, play: { gameThumbnail: null } });
    renderDetail();
    expect(await screen.findByText("BB")).toBeInTheDocument();
  });

  it("lista los resultados ordenados con el ganador arriba", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "Brass: Birmingham" });
    expect(screen.getByText("✦ Ganó")).toBeInTheDocument();
    expect(screen.getByText("92")).toBeInTheDocument();
    // "76" aparece en la celda de puntaje y en el bloque "Puntaje de claudio".
    expect(screen.getAllByText("76").length).toBeGreaterThan(0);
    expect(screen.getByText("✨ nuevo")).toBeInTheDocument();
    // Color chips.
    expect(screen.getByText("rojo")).toBeInTheDocument();
    expect(screen.getByText("azul")).toBeInTheDocument();
    // Rating de Cami.
    expect(screen.getByText("★ 8.0")).toBeInTheDocument();
    // Ganadora primero.
    const names = screen
      .getAllByText(/^(Cami|Claudio)$/)
      .map((el) => el.textContent);
    expect(names[0]).toBe("Cami");
  });

  it("muestra 'Tu puntaje' cuando el que mira es el dueño del log", async () => {
    mockUser = { _id: "u1", username: "claudio", bggUsername: "claudio" };
    renderDetail();
    expect(await screen.findByText("Tu puntaje")).toBeInTheDocument();
  });

  it("para un visitante el puntaje se atribuye al dueño y no hay acciones", async () => {
    renderDetail();
    expect(await screen.findByText("Puntaje de claudio")).toBeInTheDocument();
    expect(screen.queryByText("Editar")).toBeNull();
    expect(screen.queryByText("Eliminar")).toBeNull();
  });

  it("el dueño conectado ve Editar / Eliminar / Cargar otra", async () => {
    mockUser = {
      _id: "u1",
      username: "claudio",
      bggUsername: "claudio",
      bggConnected: true,
    };
    renderDetail();
    expect(await screen.findByText("Editar")).toBeInTheDocument();
    expect(screen.getByText("Eliminar")).toBeInTheDocument();
    expect(screen.getByText("Cargar otra")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Editar"));
    expect(await screen.findByTestId("edit-page")).toBeInTheDocument();
  });

  it("muestra los botones de compartir", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "Brass: Birmingham" });
    expect(screen.getByTitle("Compartir en WhatsApp")).toHaveAttribute(
      "href",
      expect.stringContaining("api.whatsapp.com"),
    );
    expect(screen.getByTitle("Compartir en Telegram")).toHaveAttribute(
      "href",
      expect.stringContaining("t.me/share"),
    );
    expect(screen.getByTitle("Copiar enlace")).toBeInTheDocument();
  });

  it("muestra las notas en la sección de notas", async () => {
    renderDetail();
    expect(await screen.findByText(/Partidón\./)).toBeInTheDocument();
    expect(screen.getByText("Notas")).toBeInTheDocument();
  });

  it("renderiza el panel de grupo con 2+ jugadores y lo omite en solitario", async () => {
    renderDetail();
    expect(await screen.findByTestId("group-panel")).toBeInTheDocument();

    stubDetalle({ play: { players: [BASE_PLAY.players[0]] } });
    renderDetail("/bg-watch/claudio/partidas/778");
    await waitFor(() =>
      expect(screen.getAllByRole("heading").length).toBeGreaterThan(0),
    );
    expect(screen.queryAllByTestId("group-panel")).toHaveLength(1);
  });

  it("404 → NotFound", async () => {
    server.use(
      http.get("/api/bgg/partida/:user/:playId/detalle", () =>
        HttpResponse.json(
          { message: "Partida no encontrada" },
          { status: 404 },
        ),
      ),
    );
    renderDetail();
    expect(await screen.findByTestId("not-found")).toBeInTheDocument();
  });

  it("pills de incompleta y no-rankea", async () => {
    stubDetalle({ play: { incomplete: true, nowinstats: true } });
    renderDetail();
    expect(await screen.findByText("Incompleta")).toBeInTheDocument();
    expect(screen.getByText("No cuenta para ranking")).toBeInTheDocument();
  });
});
