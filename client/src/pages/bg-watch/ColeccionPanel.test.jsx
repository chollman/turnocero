import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse, delay } from "msw";
import { server } from "../../test/server";

vi.mock("./Pagination", () => ({
  default: ({ page, totalPages, onPage }) => (
    <div data-testid="pagination">
      <button onClick={() => onPage(2)}>page-2</button>
      <span>
        {page}/{totalPages}
      </span>
    </div>
  ),
}));
vi.mock("./GameCardSkeleton", () => ({
  default: () => <div data-testid="game-card-skeleton" />,
}));

import ColeccionPanel from "./ColeccionPanel";

function renderPanel(props = {}) {
  return render(
    <MemoryRouter>
      <ColeccionPanel
        bggUsername={props.bggUsername ?? "CarcaFan"}
        onLoaded={props.onLoaded}
        // Default true so existing button-interaction tests can find it.
        // New tests opt out with canRefresh={false}.
        canRefresh={props.canRefresh ?? true}
        canCreate={props.canCreate ?? false}
      />
    </MemoryRouter>,
  );
}

function makeGame(overrides = {}) {
  return {
    id: 13,
    name: "Catán",
    thumbnail: "https://cdn/catan.jpg",
    yearPublished: 1995,
    userRating: 8.5,
    bggRating: 7.2,
    numPlays: 12,
    ...overrides,
  };
}

beforeEach(() => {
  // default: empty collection
  server.use(
    http.get("/api/bgg/coleccion/:bggUsername", () => HttpResponse.json([])),
  );
});

describe("<ColeccionPanel>", () => {
  it("shows loading skeletons initially", () => {
    // Delay garantiza que vemos el estado de loading antes de que MSW resuelva.
    server.use(
      http.get("/api/bgg/coleccion/:bggUsername", async () => {
        await delay(50);
        return HttpResponse.json([]);
      }),
    );
    renderPanel();
    // El componente muestra 8 GameCardSkeleton mientras carga.
    expect(screen.getAllByTestId("game-card-skeleton").length).toBeGreaterThan(
      0,
    );
  });

  it("shows empty state when user has no owned games", async () => {
    renderPanel();
    await waitFor(() => {
      expect(
        screen.getByText(/no tiene juegos marcados como propios/i),
      ).toBeInTheDocument();
    });
  });

  it("renders game cards when the collection loads", async () => {
    server.use(
      http.get("/api/bgg/coleccion/:bggUsername", () =>
        HttpResponse.json([
          makeGame(),
          makeGame({ id: 14, name: "Carcassonne" }),
        ]),
      ),
    );
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText("Catán")).toBeInTheDocument();
      expect(screen.getByText("Carcassonne")).toBeInTheDocument();
    });
  });

  it("con canCreate muestra 'Cargar partida' con el deep-link al form", async () => {
    server.use(
      http.get("/api/bgg/coleccion/:bggUsername", () =>
        HttpResponse.json([makeGame({ id: 13, name: "Catán" })]),
      ),
    );
    renderPanel({ canCreate: true, bggUsername: "CarcaFan" });
    const link = await screen.findByRole("link", { name: /cargar partida/i });
    expect(link).toHaveAttribute(
      "href",
      `/bg-watch/CarcaFan/partidas/nueva?juego=13&volver=${encodeURIComponent(
        "/bg-watch/CarcaFan/coleccion",
      )}`,
    );
  });

  it("sin canCreate no muestra 'Cargar partida'", async () => {
    server.use(
      http.get("/api/bgg/coleccion/:bggUsername", () =>
        HttpResponse.json([makeGame()]),
      ),
    );
    renderPanel({ canCreate: false });
    await screen.findByText("Catán");
    expect(
      screen.queryByRole("link", { name: /cargar partida/i }),
    ).toBeNull();
  });

  it("shows error message when API fails", async () => {
    server.use(
      http.get("/api/bgg/coleccion/:bggUsername", () =>
        HttpResponse.json({ message: "BGG offline" }, { status: 503 }),
      ),
    );
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText("BGG offline")).toBeInTheDocument();
    });
  });

  it("calls onLoaded callback with the collection data", async () => {
    server.use(
      http.get("/api/bgg/coleccion/:bggUsername", () =>
        HttpResponse.json([makeGame()]),
      ),
    );
    const onLoaded = vi.fn();
    renderPanel({ onLoaded });
    await waitFor(() => {
      expect(onLoaded).toHaveBeenCalled();
      const arg = onLoaded.mock.calls[0][0];
      expect(arg.length).toBe(1);
    });
  });

  it("renders the pagination info with total count", async () => {
    const games = Array.from({ length: 50 }, (_, i) =>
      makeGame({ id: i, name: `Game ${i}` }),
    );
    server.use(
      http.get("/api/bgg/coleccion/:bggUsername", () =>
        HttpResponse.json(games),
      ),
    );
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText(/50 juegos/)).toBeInTheDocument();
    });
  });

  it("paginates to next page when pagination triggers onPage", async () => {
    const games = Array.from({ length: 50 }, (_, i) =>
      makeGame({ id: i, name: `Game ${i}` }),
    );
    server.use(
      http.get("/api/bgg/coleccion/:bggUsername", () =>
        HttpResponse.json(games),
      ),
    );
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText("Game 0")).toBeInTheDocument();
    });
    // Page 1: Game 0..23. Click "page-2" exposed by Pagination stub
    fireEvent.click(screen.getByText("page-2"));
    await waitFor(() => {
      expect(screen.getByText("Game 24")).toBeInTheDocument();
    });
  });

  it('clicking "Actualizar" re-fetches the collection with ?refresh=1', async () => {
    const requestedUrls = [];
    server.use(
      http.get("/api/bgg/coleccion/:bggUsername", ({ request }) => {
        requestedUrls.push(request.url);
        return HttpResponse.json([]);
      }),
    );

    renderPanel();
    await waitFor(() => {
      expect(requestedUrls.length).toBe(1);
    });
    expect(requestedUrls[0]).not.toContain("refresh=1");

    fireEvent.click(
      screen.getByRole("button", { name: /actualizar colección/i }),
    );
    await waitFor(() => {
      expect(requestedUrls.length).toBe(2);
    });
    expect(requestedUrls[1]).toContain("refresh=1");
  });

  it("disables the refresh button while loading", async () => {
    renderPanel();
    const btn = screen.getByRole("button", { name: /actualizar colección/i });
    expect(btn).toBeDisabled();
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });
  });

  it("does NOT render the refresh button when canRefresh=false (non-owner / guest)", async () => {
    renderPanel({ canRefresh: false });
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /actualizar colección/i }),
      ).toBeNull();
    });
  });

  it("reads the X-Refresh-Cooldown-Ms response header to drive the countdown", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      server.use(
        http.get("/api/bgg/coleccion/:bggUsername", () =>
          HttpResponse.json([], {
            headers: { "X-Refresh-Cooldown-Ms": "60000" },
          }),
        ),
      );

      renderPanel();
      const btn = await screen.findByRole("button", {
        name: /actualizar colección/i,
      });

      // On mount, the server reported a 60s active cooldown — UI reflects it
      // without any click. This is the persistence guarantee across reloads.
      await waitFor(() => {
        expect(btn.textContent).toMatch(/esperá 60s/i);
      });
      expect(btn).toBeDisabled();

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
      http.get("/api/bgg/coleccion/:bggUsername", () => {
        nthRequest += 1;
        if (nthRequest === 1) {
          return HttpResponse.json([], {
            headers: { "X-Refresh-Cooldown-Ms": "0" },
          });
        }
        return HttpResponse.json(
          { message: "Esperá 45s antes de actualizar.", retryAfterMs: 45000 },
          { status: 429, headers: { "X-Refresh-Cooldown-Ms": "45000" } },
        );
      }),
    );

    renderPanel();
    const btn = await screen.findByRole("button", {
      name: /actualizar colección/i,
    });
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });

    fireEvent.click(btn);

    await waitFor(() => {
      expect(btn.textContent).toMatch(/esperá 45s/i);
    });
    expect(btn).toBeDisabled();
  });

  it('shows "—" when userRating is null', async () => {
    server.use(
      http.get("/api/bgg/coleccion/:bggUsername", () =>
        HttpResponse.json([makeGame({ userRating: null, bggRating: 7.2 })]),
      ),
    );
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText("Catán")).toBeInTheDocument();
    });
    // Tu nota → "—" (since userRating null)
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });
});
