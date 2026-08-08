import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse, delay } from "msw";
import { server } from "../../test/server";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

vi.mock("./PlayCard", () => ({
  default: ({ play, onClick }) => (
    <div data-testid="play-card" onClick={onClick}>
      {play.id}
    </div>
  ),
}));
vi.mock("./PlayCardSkeleton", () => ({
  default: () => <div data-testid="play-card-skeleton" />,
}));
vi.mock("./GameCardSkeleton", () => ({
  default: () => <div data-testid="game-card-skeleton" />,
}));
vi.mock("./Pagination", () => ({
  default: () => <div data-testid="pagination" />,
}));
vi.mock("./useBggUserMap", () => ({ default: () => ({}) }));
// Sidebar widgets — stubbed so we only assert mount/unmount per view mode here
// (each widget has its own test). They expose the data they received.
vi.mock("./widgets/Heatmap", () => ({
  default: ({ heatmap }) => (
    <div data-testid="heatmap" data-len={String((heatmap || []).length)} />
  ),
}));
vi.mock("./widgets/TopCollectionWidget", () => ({
  default: ({ games }) => (
    <div data-testid="top-collection" data-len={String((games || []).length)} />
  ),
}));
vi.mock("./widgets/WinRateWidget", () => ({
  default: ({ wins, rated }) => (
    <div
      data-testid="win-rate"
      data-wins={String(wins)}
      data-rated={String(rated)}
    />
  ),
}));

import PartidasPanel from "./PartidasPanel";

function renderPanel(props = {}) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <PartidasPanel
          bggUsername="CarcaFan"
          collection={props.collection ?? null}
          onPlayClick={props.onPlayClick || vi.fn()}
          onPlayEdit={props.onPlayEdit}
          onPlayDelete={props.onPlayDelete}
          onMetaChange={props.onMetaChange}
          // Default to true so the existing cooldown/button-interaction tests
          // can still find the "Actualizar" button. New tests opt out explicitly.
          canRefresh={props.canRefresh ?? true}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  // default empty plays + empty server-aggregated games (forces fallback to
  // collection for the "Por juego" tab unless a test overrides).
  server.use(
    http.get("/api/bgg/partidas/:bggUsername", () =>
      HttpResponse.json({ plays: [], page: 1, total: 0, totalPages: 1 }),
    ),
    http.get("/api/bgg/juegos-jugados/:bggUsername", () =>
      HttpResponse.json([]),
    ),
    http.get("/api/bgg/resumen/:bggUsername", () =>
      HttpResponse.json({
        overallStats: {
          totalWins: 0,
          totalRated: 0,
          totalPlays: 0,
          uniqueGames: 0,
          avgDuration: null,
          firstDate: null,
          lastDate: null,
        },
        heatmap: [],
      }),
    ),
  );
});

describe("<PartidasPanel>", () => {
  it("shows loading skeletons initially in list mode", () => {
    // Delay garantiza que vemos el estado de loading antes de que MSW resuelva.
    server.use(
      http.get("/api/bgg/partidas/:bggUsername", async () => {
        await delay(50);
        return HttpResponse.json({
          plays: [],
          page: 1,
          total: 0,
          totalPages: 1,
        });
      }),
    );
    renderPanel();
    // El componente muestra 5 PlayCardSkeleton mientras carga.
    expect(screen.getAllByTestId("play-card-skeleton").length).toBeGreaterThan(
      0,
    );
  });

  it("shows the four filter chips in list mode", async () => {
    renderPanel();
    // El mismo set de filtros vive en los chips (desktop) y en el dropdown
    // mobile; acotamos al grupo de chips para no chocar con el trigger del
    // dropdown (que también dice "Todas").
    const chips = within(
      screen.getByRole("group", { name: /filtrar por fecha/i }),
    );
    expect(chips.getByRole("button", { name: "Todas" })).toBeInTheDocument();
    expect(chips.getByRole("button", { name: "Este año" })).toBeInTheDocument();
    expect(chips.getByRole("button", { name: "Este mes" })).toBeInTheDocument();
    expect(chips.getByRole("button", { name: "7 días" })).toBeInTheDocument();
  });

  it("shows empty state when there are no plays (filter = all)", async () => {
    renderPanel();
    await waitFor(() => {
      expect(
        screen.getByText(/no tiene partidas registradas en bgg/i),
      ).toBeInTheDocument();
    });
  });

  it("renders a PlayCard per play returned", async () => {
    server.use(
      http.get("/api/bgg/partidas/:bggUsername", () =>
        HttpResponse.json({
          plays: [
            { id: "p1", players: [] },
            { id: "p2", players: [] },
          ],
          page: 1,
          total: 2,
          totalPages: 1,
        }),
      ),
    );
    renderPanel();
    await waitFor(() => {
      expect(screen.getAllByTestId("play-card").length).toBe(2);
    });
  });

  it("shows error when the API fails", async () => {
    server.use(
      http.get("/api/bgg/partidas/:bggUsername", () =>
        HttpResponse.json({ message: "BGG slow" }, { status: 500 }),
      ),
    );
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText("BGG slow")).toBeInTheDocument();
    });
  });

  it('switches to "Por juego" mode when toggle clicked', async () => {
    renderPanel({
      collection: [
        {
          id: 13,
          name: "Catán",
          thumbnail: null,
          yearPublished: 1995,
          numPlays: 5,
        },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Por juego" }));
    expect(screen.getByText("Catán")).toBeInTheDocument();
  });

  it("shows the empty-by-game state when no played games", async () => {
    renderPanel({
      collection: [{ id: 13, name: "Catán", numPlays: 0 }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Por juego" }));
    expect(
      screen.getByText(/no hay juegos con partidas registradas/i),
    ).toBeInTheDocument();
  });

  it("prefers server-aggregated played games over the collection-derived list", async () => {
    server.use(
      http.get("/api/bgg/juegos-jugados/:bggUsername", () =>
        HttpResponse.json([
          // Played-but-not-owned game appears here but not in collection.
          {
            id: "999",
            name: "Brass Birmingham",
            thumbnail: "bb.jpg",
            numPlays: 42,
          },
          { id: "13", name: "Catán", thumbnail: "c.jpg", numPlays: 5 },
        ]),
      ),
    );
    renderPanel({
      collection: [
        { id: 13, name: "Catán", numPlays: 5 }, // only this in the BGG collection
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Por juego" }));
    await waitFor(() => {
      expect(screen.getByText("Brass Birmingham")).toBeInTheDocument();
    });
    expect(screen.getByText("Catán")).toBeInTheDocument();
  });

  it("shows played games even when the collection is empty (private collection case)", async () => {
    // H3rmit87-style: collection fetch returned 401 → caller passes [].
    // BggPlay sync still gives us the played games via the new endpoint.
    server.use(
      http.get("/api/bgg/juegos-jugados/:bggUsername", () =>
        HttpResponse.json([
          {
            id: "174430",
            name: "Gloomhaven",
            thumbnail: "g.jpg",
            numPlays: 32,
          },
        ]),
      ),
    );
    renderPanel({ collection: [] });
    fireEvent.click(screen.getByRole("button", { name: "Por juego" }));
    await waitFor(() => {
      expect(screen.getByText("Gloomhaven")).toBeInTheDocument();
    });
  });

  it("falls back to the collection when the server returns no aggregated games", async () => {
    // Default handler in beforeEach already returns [].
    renderPanel({
      collection: [{ id: 13, name: "Catán", numPlays: 5 }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Por juego" }));
    expect(screen.getByText("Catán")).toBeInTheDocument();
  });

  it('calls onMetaChange after first successful "all" load', async () => {
    server.use(
      http.get("/api/bgg/partidas/:bggUsername", () =>
        HttpResponse.json({
          plays: [{ id: "p1", date: "2026-05-01", players: [] }],
          page: 1,
          total: 1,
          totalPages: 1,
        }),
      ),
    );
    const onMetaChange = vi.fn();
    renderPanel({ onMetaChange });
    await waitFor(() => {
      expect(onMetaChange).toHaveBeenCalled();
    });
    const arg = onMetaChange.mock.calls[0][0];
    expect(arg.total).toBe(1);
    expect(arg.lastDate).toBe("2026-05-01");
  });

  it("forwards topGame from the server response to onMetaChange", async () => {
    const topGame = {
      id: "13",
      name: "Catán",
      thumbnail: "c.jpg",
      numPlays: 7,
    };
    server.use(
      http.get("/api/bgg/partidas/:bggUsername", () =>
        HttpResponse.json({
          plays: [{ id: "p1", date: "2026-05-01", players: [] }],
          page: 1,
          total: 1,
          totalPages: 1,
          topGame,
        }),
      ),
    );
    const onMetaChange = vi.fn();
    renderPanel({ onMetaChange });
    await waitFor(() => {
      expect(onMetaChange).toHaveBeenCalled();
    });
    expect(onMetaChange.mock.calls[0][0].topGame).toEqual(topGame);
  });

  it("passes topGame: null when the server omits it", async () => {
    server.use(
      http.get("/api/bgg/partidas/:bggUsername", () =>
        HttpResponse.json({
          plays: [],
          page: 1,
          total: 0,
          totalPages: 0,
        }),
      ),
    );
    const onMetaChange = vi.fn();
    renderPanel({ onMetaChange });
    await waitFor(() => {
      expect(onMetaChange).toHaveBeenCalled();
    });
    expect(onMetaChange.mock.calls[0][0].topGame).toBeNull();
  });

  it("renders the sidebar widgets in list mode", async () => {
    renderPanel();
    await waitFor(() => {
      // El heatmap se renderiza dos veces (mobile arriba + sidebar); en jsdom
      // sin CSS ambos quedan en el DOM.
      expect(screen.getAllByTestId("heatmap").length).toBeGreaterThan(0);
    });
    expect(screen.getByTestId("top-collection")).toBeInTheDocument();
    expect(screen.getByTestId("win-rate")).toBeInTheDocument();
  });

  it("hides the sidebar widgets in 'Por juego' mode", async () => {
    renderPanel({ collection: [{ id: 13, name: "Catán", numPlays: 5 }] });
    await screen.findAllByTestId("heatmap");
    fireEvent.click(screen.getByRole("button", { name: "Por juego" }));
    expect(screen.queryByTestId("heatmap")).toBeNull();
    expect(screen.queryByTestId("win-rate")).toBeNull();
  });

  it("'Partidas del mes' button opens the monthly recap modal (list mode only)", async () => {
    renderPanel();
    await screen.findAllByTestId("heatmap");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /partidas del mes/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("hides the 'Partidas del mes' button in 'Por juego' mode", async () => {
    renderPanel({ collection: [{ id: 13, name: "Catán", numPlays: 5 }] });
    await screen.findAllByTestId("heatmap");
    fireEvent.click(screen.getByRole("button", { name: "Por juego" }));
    expect(
      screen.queryByRole("button", { name: /partidas del mes/i }),
    ).not.toBeInTheDocument();
  });

  it("feeds win-rate from the /resumen aggregation, not the page sample", async () => {
    server.use(
      http.get("/api/bgg/resumen/:bggUsername", () =>
        HttpResponse.json({
          overallStats: {
            totalWins: 8,
            totalRated: 20,
            totalPlays: 25,
            uniqueGames: 12,
            avgDuration: 75,
            firstDate: "2025-01-01",
            lastDate: "2026-06-01",
          },
          heatmap: [{ date: "2026-06-01", count: 3 }],
        }),
      ),
    );
    renderPanel();
    await waitFor(() => {
      const winRate = screen.getByTestId("win-rate");
      expect(winRate.dataset.wins).toBe("8");
      expect(winRate.dataset.rated).toBe("20");
      expect(screen.getAllByTestId("heatmap")[0].dataset.len).toBe("1");
    });
  });

  it("clicking a filter chip changes its active class", async () => {
    renderPanel();
    const yearBtn = screen.getByRole("button", { name: "Este año" });
    fireEvent.click(yearBtn);
    // The button should now have active styling
    expect(yearBtn.className).toMatch(/active/i);
  });

  it('clicking "Actualizar" re-fetches partidas with ?refresh=1', async () => {
    const requestedUrls = [];
    server.use(
      http.get("/api/bgg/partidas/:bggUsername", ({ request }) => {
        requestedUrls.push(request.url);
        return HttpResponse.json({
          plays: [],
          page: 1,
          total: 0,
          totalPages: 1,
        });
      }),
    );

    renderPanel();
    await waitFor(() => {
      expect(requestedUrls.length).toBe(1);
    });
    // First (mount) request should NOT have refresh=1
    expect(requestedUrls[0]).not.toContain("refresh=1");

    fireEvent.click(
      screen.getByRole("button", { name: /actualizar partidas/i }),
    );
    await waitFor(() => {
      expect(requestedUrls.length).toBe(2);
    });
    // Second (manual click) request should include refresh=1
    expect(requestedUrls[1]).toContain("refresh=1");
  });

  it("disables the refresh button while loading", async () => {
    renderPanel();
    const btn = screen.getByRole("button", { name: /actualizar partidas/i });
    expect(btn).toBeDisabled();
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });
  });

  it("does NOT render the refresh button when canRefresh=false (non-owner / guest)", async () => {
    renderPanel({ canRefresh: false });
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /actualizar partidas/i }),
      ).toBeNull();
    });
  });

  it('renders the "Actualizado …" label from sync.lastProbedAt when canRefresh', async () => {
    server.use(
      http.get("/api/bgg/partidas/:bggUsername", () =>
        HttpResponse.json({
          plays: [],
          page: 1,
          total: 0,
          totalPages: 1,
          sync: {
            lastProbedAt: new Date(
              Date.now() - 2 * 60 * 60 * 1000,
            ).toISOString(),
          },
        }),
      ),
    );
    renderPanel();
    expect(await screen.findByText(/actualizado/i)).toBeInTheDocument();
  });

  it("hides the freshness label when canRefresh=false", async () => {
    server.use(
      http.get("/api/bgg/partidas/:bggUsername", () =>
        HttpResponse.json({
          plays: [],
          page: 1,
          total: 0,
          totalPages: 1,
          sync: {
            lastProbedAt: new Date(
              Date.now() - 2 * 60 * 60 * 1000,
            ).toISOString(),
          },
        }),
      ),
    );
    renderPanel({ canRefresh: false });
    // Wait for the load to settle (empty state renders), then assert no label.
    await waitFor(() => {
      expect(
        screen.getByText(/no tiene partidas registradas en bgg/i),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/actualizado/i)).toBeNull();
  });

  it("reads the X-Refresh-Cooldown-Ms response header to drive the countdown", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      server.use(
        http.get("/api/bgg/partidas/:bggUsername", () =>
          HttpResponse.json(
            { plays: [], page: 1, total: 0, totalPages: 1 },
            { headers: { "X-Refresh-Cooldown-Ms": "60000" } },
          ),
        ),
      );

      renderPanel();
      const btn = await screen.findByRole("button", {
        name: /actualizar partidas/i,
      });

      // After mount, the server told us there's an active 60s cooldown — the
      // button reflects that without any click. This is the persistence guarantee.
      await waitFor(() => {
        expect(btn.textContent).toMatch(/esperá 60s/i);
      });
      expect(btn).toBeDisabled();

      // Counter ticks down with wall-clock — advance 30s
      vi.advanceTimersByTime(30_000);
      await waitFor(() => {
        expect(btn.textContent).toMatch(/esperá 30s/i);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("syncs cooldown from a 429 response header", async () => {
    let nthRequest = 0;
    server.use(
      http.get("/api/bgg/partidas/:bggUsername", () => {
        nthRequest += 1;
        if (nthRequest === 1) {
          // Initial mount load — clean response, no cooldown yet.
          return HttpResponse.json(
            { plays: [], page: 1, total: 0, totalPages: 1 },
            { headers: { "X-Refresh-Cooldown-Ms": "0" } },
          );
        }
        // Manual click → server says still in cooldown.
        return HttpResponse.json(
          { message: "Esperá 45s antes de actualizar.", retryAfterMs: 45000 },
          { status: 429, headers: { "X-Refresh-Cooldown-Ms": "45000" } },
        );
      }),
    );

    renderPanel();
    const btn = await screen.findByRole("button", {
      name: /actualizar partidas/i,
    });
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });

    fireEvent.click(btn);

    // The 429 carries the cooldown header — the button must reflect it.
    await waitFor(() => {
      expect(btn.textContent).toMatch(/esperá 45s/i);
    });
    expect(btn).toBeDisabled();
  });

  it("refresh button stays enabled after a successful refresh with no active cooldown header", async () => {
    // Server returns "0" or omits the header — button should be available.
    server.use(
      http.get("/api/bgg/partidas/:bggUsername", () =>
        HttpResponse.json(
          { plays: [], page: 1, total: 0, totalPages: 1 },
          { headers: { "X-Refresh-Cooldown-Ms": "0" } },
        ),
      ),
    );
    renderPanel();
    const btn = await screen.findByRole("button", {
      name: /actualizar partidas/i,
    });
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
      // El ícono ahora es un SVG (sin glifo ↻); el texto es sólo la etiqueta.
      expect(btn.textContent).toMatch(/^actualizar$/i);
    });
  });
});
