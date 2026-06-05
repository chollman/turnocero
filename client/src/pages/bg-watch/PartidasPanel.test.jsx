import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse, delay } from "msw";
import { server } from "../../test/server";

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

import PartidasPanel from "./PartidasPanel";

function renderPanel(props = {}) {
  return render(
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
    </MemoryRouter>,
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
    expect(screen.getByRole("button", { name: "Todas" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Este año" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Este mes" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "7 días" })).toBeInTheDocument();
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

  it('renders the "Actualizado hace …" label from sync.lastProbedAt when canRefresh', async () => {
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
    expect(await screen.findByText(/actualizado hace/i)).toBeInTheDocument();
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
    expect(screen.queryByText(/actualizado hace/i)).toBeNull();
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
      expect(btn.textContent).toMatch(/^↻ actualizar$/i);
    });
  });
});
