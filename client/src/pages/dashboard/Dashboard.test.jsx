import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

vi.mock("./TableCard", () => ({
  default: ({ table }) => (
    <div data-testid="table-card">
      {table.boardGame} · host: {table.host?.username}
    </div>
  ),
}));

import Dashboard from "./Dashboard";
import { useAuth } from "../../context/AuthContext";

function makeTable(overrides = {}) {
  return {
    _id: overrides._id || `t${Math.random()}`,
    boardGame: overrides.boardGame || "Catán",
    date: overrides.date || new Date(Date.now() + 7 * 86400000).toISOString(),
    maxPlayers: overrides.maxPlayers ?? 4,
    players: overrides.players || [],
    location: overrides.location || "BA",
    host: overrides.host || {
      _id: "host1",
      username: "host",
      avatar: { url: "", publicId: "" },
    },
    status: overrides.status || "open",
    privacy: overrides.privacy || "public",
    ...overrides,
  };
}

beforeEach(() => {
  // Cada test parte de un localStorage limpio para que el chip persistido
  // o el viewMode de un test anterior no se filtre.
  localStorage.clear();
  useAuth.mockReturnValue({ user: { _id: "me", username: "me" } });
  server.use(
    http.get("/api/tables", () =>
      HttpResponse.json({
        tables: [
          makeTable({ boardGame: "Wingspan" }),
          makeTable({ boardGame: "Carcassonne" }),
        ],
        page: 1,
        pages: 1,
        total: 2,
      }),
    ),
    http.get("/api/tables/mine", () =>
      HttpResponse.json({
        tables: [makeTable({ boardGame: "MyOwnGame" })],
        page: 1,
        pages: 1,
        total: 1,
      }),
    ),
  );
});

function renderDashboard() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Abre el popover de ListFilters. Los chips y el slider de distancia viven
// dentro de ese popover (no en línea), así que cualquier test que interactúe
// con ellos debe abrirlo primero.
function openFilters() {
  fireEvent.click(screen.getByRole("button", { name: /^filtros/i }));
}

describe("<Dashboard>", () => {
  it("renders the loading skeleton initially and then the table list", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getAllByTestId("table-card")).toHaveLength(2);
    });
    expect(screen.getByText(/Wingspan/)).toBeInTheDocument();
    expect(screen.getByText(/Carcassonne/)).toBeInTheDocument();
  });

  it("shows the total count from the API in the eyebrow", async () => {
    renderDashboard();
    await waitFor(() => {
      const eyebrows = screen.getAllByText(
        (_content, el) =>
          el?.tagName === "P" && /MESAS ACTIVAS/i.test(el.textContent),
      );
      expect(eyebrows.length).toBeGreaterThan(0);
      eyebrows.forEach((eb) => expect(eb.textContent).toMatch(/2/));
    });
  });

  it('clicking "Mis mesas" inside Filtros popover switches to the /mine endpoint', async () => {
    renderDashboard();
    await screen.findByText(/Wingspan/);
    openFilters();
    fireEvent.click(screen.getByRole("button", { name: /mis mesas/i }));
    await waitFor(() =>
      expect(screen.getByText(/MyOwnGame/)).toBeInTheDocument(),
    );
  });

  it("shows an error message when the API fails", async () => {
    server.use(
      http.get("/api/tables", () => HttpResponse.json({}, { status: 500 })),
    );
    renderDashboard();
    expect(
      await screen.findByText(/Error al cargar las mesas/i),
    ).toBeInTheDocument();
  });

  it("persists filter selection via localStorage", async () => {
    renderDashboard();
    await screen.findByText(/Wingspan/);
    openFilters();
    fireEvent.click(screen.getByRole("button", { name: /públicas/i }));
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("turnocero_mesas_filter"))).toBe(
        "public",
      );
    });
  });

  it("resets stored filter to 'all' when the chip is auth-only and user logs out", async () => {
    localStorage.setItem("turnocero_mesas_filter", JSON.stringify("mine"));
    useAuth.mockReturnValue({ user: null }); // anon
    renderDashboard();
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("turnocero_mesas_filter"))).toBe(
        "all",
      );
    });
  });

  it("anon users don't see auth-only chips in the filter popover", async () => {
    useAuth.mockReturnValue({ user: null });
    renderDashboard();
    await screen.findByText(/Wingspan/);
    openFilters();
    expect(
      screen.queryByRole("button", { name: /^mis mesas$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^hosting$/i }),
    ).not.toBeInTheDocument();
    // Pero "Todas" y "Públicas" sí están.
    expect(screen.getByRole("button", { name: /^todas$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^públicas$/i }),
    ).toBeInTheDocument();
  });
});

describe("<Dashboard> — radius filter (inside Filtros popover)", () => {
  it("shows a CTA to add address when the user has no direccion", async () => {
    useAuth.mockReturnValue({ user: { _id: "me", username: "me" } });
    renderDashboard();
    await screen.findByText(/Wingspan/);
    openFilters();
    expect(screen.getByText(/agregá tu dirección/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /tu perfil/i });
    expect(link).toHaveAttribute("href", "/perfil");
    expect(screen.getByLabelText(/radio máximo/i)).toBeDisabled();
  });

  it("enables the slider and shows the prompt when user has direccion", async () => {
    useAuth.mockReturnValue({
      user: {
        _id: "me",
        username: "me",
        direccion: { texto: "CABA", lat: -34.6, lng: -58.4 },
      },
    });
    renderDashboard();
    await screen.findByText(/Wingspan/);
    openFilters();
    expect(screen.getByText(/filtrá por/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/radio máximo/i)).not.toBeDisabled();
  });

  it("fires a re-fetch with ?maxDistanceKm when slider moves", async () => {
    useAuth.mockReturnValue({
      user: {
        _id: "me",
        username: "me",
        direccion: { texto: "CABA", lat: -34.6, lng: -58.4 },
      },
    });
    let lastUrl = null;
    server.use(
      http.get("/api/tables", ({ request }) => {
        lastUrl = request.url;
        return HttpResponse.json({
          tables: [makeTable({ boardGame: "Wingspan" })],
          page: 1,
          pages: 1,
          total: 1,
        });
      }),
    );
    renderDashboard();
    await screen.findByText(/Wingspan/);
    openFilters();

    const slider = screen.getByLabelText(/radio máximo/i);
    fireEvent.change(slider, { target: { value: "25" } });

    expect(await screen.findByText("25 km")).toBeInTheDocument();
    await waitFor(
      () => {
        expect(lastUrl).toMatch(/maxDistanceKm=25/);
      },
      { timeout: 1500 },
    );
  });

  it("does NOT send maxDistanceKm when slider is at 0", async () => {
    useAuth.mockReturnValue({
      user: {
        _id: "me",
        username: "me",
        direccion: { texto: "CABA", lat: -34.6, lng: -58.4 },
      },
    });
    let lastUrl = null;
    server.use(
      http.get("/api/tables", ({ request }) => {
        lastUrl = request.url;
        return HttpResponse.json({ tables: [], page: 1, pages: 1, total: 0 });
      }),
    );
    renderDashboard();
    await waitFor(() => expect(lastUrl).not.toBeNull());
    expect(lastUrl).not.toMatch(/maxDistanceKm/);
  });

  it('"+" button increments radius by 1 km', async () => {
    useAuth.mockReturnValue({
      user: {
        _id: "me",
        username: "me",
        direccion: { texto: "CABA", lat: -34.6, lng: -58.4 },
      },
    });
    renderDashboard();
    await screen.findByText(/Wingspan/);
    openFilters();
    const plus = screen.getByRole("button", { name: /aumentar radio/i });
    fireEvent.click(plus);
    expect(await screen.findByText("1 km")).toBeInTheDocument();
    fireEvent.click(plus);
    fireEvent.click(plus);
    expect(await screen.findByText("3 km")).toBeInTheDocument();
  });

  it('"−" button decrements radius by 1 km but never below 0', async () => {
    useAuth.mockReturnValue({
      user: {
        _id: "me",
        username: "me",
        direccion: { texto: "CABA", lat: -34.6, lng: -58.4 },
      },
    });
    renderDashboard();
    await screen.findByText(/Wingspan/);
    openFilters();
    const slider = screen.getByLabelText(/radio máximo/i);
    fireEvent.change(slider, { target: { value: "3" } });
    expect(await screen.findByText("3 km")).toBeInTheDocument();

    const minus = screen.getByRole("button", { name: /disminuir radio/i });
    fireEvent.click(minus);
    fireEvent.click(minus);
    expect(await screen.findByText("1 km")).toBeInTheDocument();
    fireEvent.click(minus);
    expect(await screen.findByText("Sin límite")).toBeInTheDocument();
    expect(minus).toBeDisabled();
  });

  it("step buttons are disabled when user has no direccion", async () => {
    useAuth.mockReturnValue({ user: { _id: "me", username: "me" } });
    renderDashboard();
    await screen.findByText(/Wingspan/);
    openFilters();
    expect(
      screen.getByRole("button", { name: /disminuir radio/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /aumentar radio/i }),
    ).toBeDisabled();
  });

  it("'Filtros' trigger shows an active-count badge when distance or chip differ from default", async () => {
    useAuth.mockReturnValue({
      user: {
        _id: "me",
        username: "me",
        direccion: { texto: "CABA", lat: -34.6, lng: -58.4 },
      },
    });
    renderDashboard();
    await screen.findByText(/Wingspan/);
    // Sin cambios: el trigger es solo "Filtros" sin badge.
    expect(
      screen.queryByLabelText(/\d+ filtros activos/i),
    ).not.toBeInTheDocument();
    // Cambiamos un chip → 1 filtro activo.
    openFilters();
    fireEvent.click(screen.getByRole("button", { name: /públicas/i }));
    expect(screen.getByLabelText(/1 filtros activos/i)).toBeInTheDocument();
  });
});
