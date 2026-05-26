import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

// TableCard is exercised in TableCard.test.jsx (or stubbed here to avoid pulling in
// dozens of child components — keep this test focused on Dashboard logic).
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
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
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
    // The eyebrow is duplicated in mobile header + desktop hero. Both should contain the count.
    await waitFor(() => {
      const eyebrows = screen.getAllByText(
        (_content, el) =>
          el?.tagName === "P" && /MESAS ACTIVAS/i.test(el.textContent),
      );
      expect(eyebrows.length).toBeGreaterThan(0);
      eyebrows.forEach((eb) => expect(eb.textContent).toMatch(/2/));
    });
  });

  it('clicking "Mis mesas" switches to the /mine endpoint', async () => {
    renderDashboard();
    await screen.findByText(/Wingspan/);
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
});

describe("<Dashboard> — radius filter", () => {
  it("shows a CTA to add address when the user has no direccion", async () => {
    useAuth.mockReturnValue({ user: { _id: "me", username: "me" } }); // sin direccion
    renderDashboard();
    expect(await screen.findByText(/agregá tu dirección/i)).toBeInTheDocument();
    // El link va a /perfil.
    const link = screen.getByRole("link", { name: /tu perfil/i });
    expect(link).toHaveAttribute("href", "/perfil");
    // Slider deshabilitado.
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
    expect(await screen.findByText(/filtrá por/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/radio máximo/i)).not.toBeDisabled();
  });

  it("updates the displayed label and fires a re-fetch with ?maxDistanceKm when slider moves", async () => {
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

    const slider = screen.getByLabelText(/radio máximo/i);
    fireEvent.change(slider, { target: { value: "25" } });

    // Label refleja el valor inmediato (radiusValue span tiene exactamente "25 km").
    expect(await screen.findByText("25 km")).toBeInTheDocument();
    // El fetch con el nuevo radio se dispara después del debounce (300ms).
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

  it("renders − and + step buttons next to the slider", async () => {
    useAuth.mockReturnValue({
      user: {
        _id: "me",
        username: "me",
        direccion: { texto: "CABA", lat: -34.6, lng: -58.4 },
      },
    });
    renderDashboard();
    expect(
      await screen.findByRole("button", { name: /disminuir radio/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /aumentar radio/i }),
    ).toBeInTheDocument();
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
    const plus = await screen.findByRole("button", { name: /aumentar radio/i });
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
    const slider = await screen.findByLabelText(/radio máximo/i);
    fireEvent.change(slider, { target: { value: "3" } });
    expect(await screen.findByText("3 km")).toBeInTheDocument();

    const minus = screen.getByRole("button", { name: /disminuir radio/i });
    fireEvent.click(minus);
    fireEvent.click(minus);
    expect(await screen.findByText("1 km")).toBeInTheDocument();
    fireEvent.click(minus);
    // Llegó a 0 → label cambia a "Sin límite".
    expect(await screen.findByText("Sin límite")).toBeInTheDocument();
    // "−" queda deshabilitado en 0.
    expect(minus).toBeDisabled();
  });

  it('"+" button is disabled when radius reaches MAX (100km)', async () => {
    useAuth.mockReturnValue({
      user: {
        _id: "me",
        username: "me",
        direccion: { texto: "CABA", lat: -34.6, lng: -58.4 },
      },
    });
    renderDashboard();
    const slider = await screen.findByLabelText(/radio máximo/i);
    fireEvent.change(slider, { target: { value: "100" } });
    expect(await screen.findByText("100 km")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /aumentar radio/i }),
    ).toBeDisabled();
  });

  it("both step buttons are disabled when user has no direccion", async () => {
    useAuth.mockReturnValue({ user: { _id: "me", username: "me" } });
    renderDashboard();
    expect(
      await screen.findByRole("button", { name: /disminuir radio/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /aumentar radio/i }),
    ).toBeDisabled();
  });
});
