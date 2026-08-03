import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import BgWatchHomeWidget from "./BgWatchHomeWidget";

const DISMISS_KEY = "turnocero_bgwatch_promo_dismissed";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWidget(props = {}) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <BgWatchHomeWidget user={props.user} dismissible={props.dismissible} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.removeItem(DISMISS_KEY);
  // Two distinct calls: year (mindate=YYYY-01-01) and month (mindate=YYYY-MM-01).
  // The mock differentiates by whether the mindate's month is January (year
  // request) or any other month (month request).
  server.use(
    http.get("/api/bgg/partidas/:bggUsername", ({ request }) => {
      const url = new URL(request.url);
      const mindate = url.searchParams.get("mindate") || "";
      const isMonthQuery = /^\d{4}-(0[2-9]|1[0-2])-01$/.test(mindate);
      if (isMonthQuery) {
        return HttpResponse.json({ total: 8, plays: [] });
      }
      return HttpResponse.json({
        total: 42,
        plays: [
          {
            id: "p1",
            gameId: 13,
            gameName: "Catán",
            gameThumbnail: "https://cdn/c.jpg",
            date: "2026-05-01",
            quantity: 1,
            players: [{ username: "CarcaFan", win: true }],
          },
          {
            id: "p2",
            gameId: 13,
            gameName: "Catán",
            gameThumbnail: "https://cdn/c.jpg",
            date: "2026-05-12",
            quantity: 1,
            players: [],
          },
          {
            id: "p3",
            gameId: 14,
            gameName: "Carcassonne",
            gameThumbnail: null,
            date: "2026-04-30",
            quantity: 1,
            players: [],
          },
        ],
      });
    }),
  );
});

describe("<BgWatchHomeWidget>", () => {
  it("renders nothing when no user", () => {
    const { container } = renderWidget({ user: null });
    expect(container.firstChild).toBeNull();
  });

  it("renders the PromoView when user has no BG Watch connection", () => {
    renderWidget({ user: { _id: "me", username: "me" } });
    expect(
      screen.getByText(/¿Llevás tus partidas en BGG\?/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /activá bg watch/i }),
    ).toHaveAttribute("href", "/bg-watch");
  });

  it("does NOT show dismiss button when not dismissible", () => {
    renderWidget({ user: { _id: "me" } });
    expect(
      screen.queryByLabelText(/no volver a mostrar/i),
    ).not.toBeInTheDocument();
  });

  it("shows dismiss button when dismissible=true", () => {
    renderWidget({ user: { _id: "me" }, dismissible: true });
    expect(screen.getByLabelText(/no volver a mostrar/i)).toBeInTheDocument();
  });

  it("clicking dismiss removes the widget and writes to localStorage", () => {
    const { container } = renderWidget({
      user: { _id: "me" },
      dismissible: true,
    });
    fireEvent.click(screen.getByLabelText(/no volver a mostrar/i));
    expect(container.firstChild).toBeNull();
    expect(localStorage.getItem(DISMISS_KEY)).toBe("1");
  });

  it("returns null when promo was already dismissed", () => {
    localStorage.setItem(DISMISS_KEY, "1");
    const { container } = renderWidget({
      user: { _id: "me" },
      dismissible: true,
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders ConnectedView with year stats when user has bggConnected", async () => {
    renderWidget({
      user: {
        _id: "me",
        bggUsername: "CarcaFan",
        bggConnected: true,
        bggInvalid: false,
      },
    });
    await waitFor(() => {
      expect(
        screen.getByText(/42 partidas registradas este año/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/tu bg watch/i)).toBeInTheDocument();
    expect(screen.getByText(/este mes/i)).toBeInTheDocument();
    expect(screen.getByText(/más jugado/i)).toBeInTheDocument();
    // Most played comes from the response (Catán appears twice; Carcassonne once).
    const mostPlayed = screen.getByText("Catán");
    expect(mostPlayed).toBeInTheDocument();
    // Full name is mirrored as a native tooltip via the title attribute so
    // long game names that get truncated are still readable on hover.
    expect(mostPlayed).toHaveAttribute("title", "Catán");
    // The eyebrow link should go to the user's BG Watch profile.
    expect(
      screen.getByRole("link", { name: /ver historial/i }),
    ).toHaveAttribute("href", "/bg-watch/CarcaFan");
  });

  it("muestra skeletons mientras carga (en lugar de guiones)", async () => {
    renderWidget({
      user: {
        _id: "me",
        bggUsername: "CarcaFan",
        bggConnected: true,
        bggInvalid: false,
      },
    });
    // Estado de carga inicial: skeleton presente y SIN guiones.
    expect(
      screen.getByRole("status", { name: /cargando tus partidas/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
    // Al resolver, el skeleton desaparece.
    await waitFor(() =>
      expect(
        screen.queryByRole("status", { name: /cargando/i }),
      ).not.toBeInTheDocument(),
    );
  });

  // Regression: BG Watch read-only (solo bggUsername, sin la conexión por
  // password) debe mostrar la vista conectada, NO el promo "¿Llevás tus
  // partidas en BGG?". Antes exigía bggConnected y el read-only veía el promo.
  it("renders ConnectedView for a read-only user (bggUsername without bggConnected)", async () => {
    renderWidget({
      user: { _id: "me", bggUsername: "CarcaFan", bggConnected: false },
    });
    await waitFor(() => {
      expect(screen.getByText(/tu bg watch/i)).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/¿Llevás tus partidas en BGG\?/i),
    ).not.toBeInTheDocument();
  });

  it("renders empty-year headline when ConnectedView has no plays", async () => {
    server.use(
      http.get("/api/bgg/partidas/:bggUsername", () =>
        HttpResponse.json({ total: 0, plays: [] }),
      ),
    );
    renderWidget({
      user: { _id: "me", bggUsername: "CarcaFan", bggConnected: true },
    });
    await waitFor(() => {
      expect(
        screen.getByText(/sumá tu primera partida del año/i),
      ).toBeInTheDocument();
    });
  });

  it("renders error state when API fails", async () => {
    server.use(
      http.get("/api/bgg/partidas/:bggUsername", () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );
    renderWidget({
      user: { _id: "me", bggUsername: "CarcaFan", bggConnected: true },
    });
    await waitFor(() => {
      expect(screen.getByText(/no se pudieron cargar/i)).toBeInTheDocument();
    });
  });

  it("renders PromoView (not ConnectedView) when bggInvalid is true", () => {
    renderWidget({
      user: {
        _id: "me",
        bggUsername: "CarcaFan",
        bggConnected: true,
        bggInvalid: true,
      },
    });
    expect(
      screen.getByText(/¿Llevás tus partidas en BGG\?/i),
    ).toBeInTheDocument();
  });

  it('"+ Registrar partida" CTA links to the user\'s play creator', () => {
    renderWidget({
      user: { _id: "me", bggUsername: "CarcaFan", bggConnected: true },
    });
    expect(
      screen.getByRole("link", { name: /registrar partida/i }),
    ).toHaveAttribute("href", "/bg-watch/CarcaFan/partidas/nueva");
  });
});
