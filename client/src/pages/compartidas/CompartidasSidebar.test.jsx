import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

const useAuthMock = vi.fn();
const useSiteConfigMock = vi.fn();

vi.mock("../../context/AuthContext", () => ({ useAuth: () => useAuthMock() }));
vi.mock("../../context/SiteConfigContext", () => ({
  useSiteConfig: () => useSiteConfigMock(),
}));
vi.mock("../../components/shared/GameTile", () => ({
  default: ({ game }) => <div data-testid="game-tile">{game}</div>,
}));
vi.mock("./BgWatchHomeWidget", () => ({
  default: () => <div data-testid="bg-widget" />,
}));
vi.mock("../../components/shared/GuestJoinBanner", () => ({
  default: ({ variant }) => (
    <div data-testid="guest-join" data-variant={variant} />
  ),
}));

import CompartidasSidebar from "./CompartidasSidebar";

function renderSidebar() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <CompartidasSidebar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useAuthMock.mockReturnValue({ user: { _id: "me", username: "me" } });
  useSiteConfigMock.mockReturnValue({
    isSectionEnabled: () => true,
  });
  server.use(
    http.get("/api/tables/mine", () =>
      HttpResponse.json({
        tables: [
          {
            _id: "t1",
            boardGame: "Catán",
            date: new Date(Date.now() + 86400000).toISOString(),
            maxPlayers: 4,
            players: [{ _id: "p1" }],
            status: "open",
          },
        ],
      }),
    ),
    http.get("/api/tables/top-games", () =>
      HttpResponse.json([
        { game: "Catán", count: 25 },
        { game: "Carcassonne", count: 15 },
      ]),
    ),
  );
});

describe("<CompartidasSidebar>", () => {
  it("renders the BgWatchHomeWidget when bgwatch is enabled", () => {
    renderSidebar();
    expect(screen.getByTestId("bg-widget")).toBeInTheDocument();
  });

  it("hides BgWatchHomeWidget when section is disabled", () => {
    useSiteConfigMock.mockReturnValue({
      isSectionEnabled: (key) => key !== "bgwatch",
    });
    renderSidebar();
    expect(screen.queryByTestId("bg-widget")).not.toBeInTheDocument();
  });

  it("renders the próximas mesas widget when mesas is enabled", () => {
    renderSidebar();
    expect(screen.getByText("Próximas partidas")).toBeInTheDocument();
  });

  it("hides the mesas widget when section is disabled", () => {
    useSiteConfigMock.mockReturnValue({
      isSectionEnabled: (key) => key !== "mesas",
    });
    renderSidebar();
    expect(screen.queryByText("Próximas partidas")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Top juegos esta semana"),
    ).not.toBeInTheDocument();
  });

  it("renders upcoming tables after fetch", async () => {
    renderSidebar();
    await waitFor(() => {
      // "Catán" appears in the GameTile stub, tableGame span, and the top-games gameName span.
      expect(screen.getAllByText("Catán").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders the empty state when no upcoming tables", async () => {
    server.use(
      http.get("/api/tables/mine", () => HttpResponse.json({ tables: [] })),
    );
    renderSidebar();
    await waitFor(() => {
      expect(screen.getByText(/sin mesas próximas/i)).toBeInTheDocument();
    });
    expect(
      screen.getByRole("link", { name: /\+ crear mesa/i }),
    ).toHaveAttribute("href", "/mesas/crear");
  });

  it("renders top games with rank and count", async () => {
    renderSidebar();
    await waitFor(() => {
      expect(screen.getByText("Top juegos esta semana")).toBeInTheDocument();
      expect(screen.getByText("25")).toBeInTheDocument();
      expect(screen.getByText("15")).toBeInTheDocument();
      expect(screen.getByText("Carcassonne")).toBeInTheDocument();
    });
  });

  it("renders empty top-games state when API returns []", async () => {
    server.use(http.get("/api/tables/top-games", () => HttpResponse.json([])));
    renderSidebar();
    await waitFor(() => {
      expect(screen.getByText(/sin datos esta semana/i)).toBeInTheDocument();
    });
  });

  it("does not render the guest join card for logged-in users", () => {
    renderSidebar();
    expect(screen.queryByTestId("guest-join")).not.toBeInTheDocument();
  });

  it("sells to guests: shows the join card + community top games, hides personal widgets", async () => {
    useAuthMock.mockReturnValue({ user: null });
    renderSidebar();

    // Tarjeta de conversión (variante card) presente; widgets personales no.
    const card = screen.getByTestId("guest-join");
    expect(card).toHaveAttribute("data-variant", "card");
    expect(screen.queryByTestId("bg-widget")).not.toBeInTheDocument();
    expect(screen.queryByText("Próximas partidas")).not.toBeInTheDocument();

    // "Top juegos" (público) sí se muestra como prueba social.
    await waitFor(() => {
      expect(screen.getByText("Top juegos esta semana")).toBeInTheDocument();
    });
    expect(screen.getByText("Carcassonne")).toBeInTheDocument();
  });

  it("hides the top-games widget from guests when there is no data", async () => {
    useAuthMock.mockReturnValue({ user: null });
    server.use(http.get("/api/tables/top-games", () => HttpResponse.json([])));
    renderSidebar();
    // El guest no debe ver un "Sin datos esta semana" deslucido.
    await waitFor(() => {
      expect(screen.getByTestId("guest-join")).toBeInTheDocument();
    });
    expect(
      screen.queryByText("Top juegos esta semana"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/sin datos esta semana/i)).not.toBeInTheDocument();
  });
});
