import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));

// Heavy children — stub for focused testing.
vi.mock("./TableDetailSkeleton", () => ({
  default: () => <div>loading-skeleton</div>,
}));
vi.mock("../../components/shared/MesaTile", () => ({ default: () => null }));
vi.mock("../../components/shared/TableMap", () => ({
  default: () => <div data-testid="table-map" />,
}));
vi.mock("../../components/shared/LoginPromptModal", () => ({
  default: ({ isOpen, message }) =>
    isOpen ? <div data-testid="login-prompt">{message}</div> : null,
}));

// Mock socket.io-client so TableDetail's `io(...)` connection is inert.
vi.mock("socket.io-client", () => ({
  io: () => ({
    on: () => {},
    off: () => {},
    emit: () => {},
    disconnect: () => {},
    connect: () => {},
  }),
}));

import TableDetail from "./TableDetail";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";

function makeTable(overrides = {}) {
  return {
    _id: "t1",
    boardGame: "Catán",
    date: new Date(Date.now() + 7 * 86400000).toISOString(),
    maxPlayers: 4,
    players: [],
    location: "Buenos Aires",
    description: "Una noche tranquila",
    rules: "",
    tags: [],
    host: {
      _id: "host1",
      username: "host1",
      avatar: { url: "", publicId: "" },
      displayName: "Host User",
    },
    status: "open",
    privacy: "public",
    pendingRequests: [],
    followers: [],
    images: [],
    ...overrides,
  };
}

function setupTable(table) {
  server.use(
    http.get("/api/tables/:id", () => HttpResponse.json(table)),
    http.get("/api/tables/:id/messages", () => HttpResponse.json([])),
    http.get("/api/tables/:id/comments", () => HttpResponse.json([])),
    http.get("/api/tables/:id/ratings", () =>
      HttpResponse.json({ ratings: [], avg: null, count: 0 }),
    ),
  );
}

function renderTableDetail({ user = null, id = "t1" } = {}) {
  useAuth.mockReturnValue({ user });
  useNotifications.mockReturnValue({
    setActiveTable: vi.fn(),
    addToast: vi.fn(),
  });
  return render(
    <MemoryRouter initialEntries={[`/mesas/${id}`]}>
      <Routes>
        <Route path="/mesas/:id" element={<TableDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  setupTable(makeTable());
});

describe("<TableDetail>", () => {
  it("renders the board game name in the banner heading", async () => {
    renderTableDetail();
    expect(
      await screen.findByRole("heading", { name: "Catán" }),
    ).toBeInTheDocument();
  });

  it("renders the location and description", async () => {
    renderTableDetail();
    await screen.findByRole("heading", { name: "Catán" });
    // Location renders in meta cell + MesaStub row.
    expect(screen.getAllByText("Buenos Aires").length).toBeGreaterThan(0);
    expect(screen.getByText("Una noche tranquila")).toBeInTheDocument();
  });

  it("shows the loading skeleton initially", () => {
    renderTableDetail();
    expect(screen.getByText("loading-skeleton")).toBeInTheDocument();
  });

  it("renders tags in the banner when present", async () => {
    setupTable(makeTable({ tags: ["Estrategia", "120-180min"] }));
    renderTableDetail();
    await screen.findByRole("heading", { name: "Catán" });
    expect(screen.getByText("Estrategia")).toBeInTheDocument();
    expect(screen.getByText("120-180min")).toBeInTheDocument();
  });

  it("renders rules section when rules are set", async () => {
    setupTable(makeTable({ rules: "Sin alianzas. Llegar 10 min antes." }));
    renderTableDetail();
    await screen.findByRole("heading", { name: "Catán" });
    expect(
      screen.getByText("Sin alianzas. Llegar 10 min antes."),
    ).toBeInTheDocument();
    expect(screen.getByText(/reglas de la casa/i)).toBeInTheDocument();
  });

  it("handles a 404 gracefully (no crash)", async () => {
    server.use(
      http.get("/api/tables/:id", () => HttpResponse.json({}, { status: 404 })),
    );
    const { container } = renderTableDetail();
    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });

  // -- User role variations ----------------------------------------------

  it('host sees the "Sos el host" stub state + admin actions', async () => {
    setupTable(
      makeTable({
        host: {
          _id: "host1",
          username: "host1",
          avatar: { url: "", publicId: "" },
        },
      }),
    );
    renderTableDetail({
      user: { _id: "host1", username: "host1", isAdmin: false },
    });
    await screen.findByRole("heading", { name: "Catán" });
    expect(screen.getByText(/sos el host/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editar/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Cancelar$/i }),
    ).toBeInTheDocument();
  });

  it('player sees "Estás dentro" + Abandonar button', async () => {
    setupTable(
      makeTable({
        players: [
          { _id: "me", username: "me", avatar: { url: "", publicId: "" } },
        ],
      }),
    );
    renderTableDetail({ user: { _id: "me", username: "me", isAdmin: false } });
    await screen.findByRole("heading", { name: "Catán" });
    expect(screen.getByText(/estás dentro/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /abandonar mesa/i }),
    ).toBeInTheDocument();
  });

  it('guest sees "Unirme a la mesa" CTA + Seguir mesa button', async () => {
    setupTable(makeTable());
    renderTableDetail({
      user: { _id: "other", username: "other", isAdmin: false },
    });
    await screen.findByRole("heading", { name: "Catán" });
    expect(
      screen.getByRole("button", { name: /unirme a la mesa/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /seguir mesa/i }),
    ).toBeInTheDocument();
  });

  it('anonymous user sees "Iniciá sesión para unirte" CTA', async () => {
    setupTable(makeTable());
    renderTableDetail({ user: null });
    await screen.findByRole("heading", { name: "Catán" });
    expect(
      screen.getByRole("button", { name: /iniciá sesión para unirte/i }),
    ).toBeInTheDocument();
  });

  it('guest with pending request sees "Solicitud enviada" + Cancelar solicitud', async () => {
    // Public tables can have pendingRequests too (it's just a stale flow for
    // tables that flipped from private to public). The page must still render.
    setupTable(
      makeTable({
        pendingRequests: [{ _id: "me", username: "me" }],
      }),
    );
    renderTableDetail({ user: { _id: "me", username: "me", isAdmin: false } });
    await screen.findByRole("heading", { name: "Catán" });
    expect(screen.getByText(/solicitud enviada/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancelar solicitud/i }),
    ).toBeInTheDocument();
  });

  it('full table shows "Mesa llena" disabled CTA', async () => {
    setupTable(
      makeTable({
        maxPlayers: 2,
        players: [
          { _id: "a", username: "a", avatar: { url: "", publicId: "" } },
          { _id: "b", username: "b", avatar: { url: "", publicId: "" } },
        ],
      }),
    );
    renderTableDetail({
      user: { _id: "other", username: "other", isAdmin: false },
    });
    await screen.findByRole("heading", { name: "Catán" });
    expect(screen.getByRole("button", { name: /mesa llena/i })).toBeDisabled();
  });

  it("cancelled table shows Cancelada badge + disabled CTA", async () => {
    setupTable(makeTable({ status: "cancelled" }));
    renderTableDetail({
      user: { _id: "other", username: "other", isAdmin: false },
    });
    await screen.findByRole("heading", { name: "Catán" });
    // "Cancelada" appears as a banner badge.
    expect(screen.getAllByText(/cancelada/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /mesa cancelada/i }),
    ).toBeDisabled();
  });

  it("past mesa shows the 'Mesa finalizada' banner and freezes the stub CTA", async () => {
    setupTable(
      makeTable({
        date: new Date(Date.now() - 86400000).toISOString(),
        host: { _id: "host1", username: "host1" },
      }),
    );
    renderTableDetail({
      user: { _id: "host1", username: "host1", isAdmin: false },
    });
    await screen.findByRole("heading", { name: "Catán" });
    // Banner explicativo arriba del layout.
    expect(screen.getByText(/mesa finalizada\./i)).toBeInTheDocument();
    // Aún el host pierde "Editar" / "Cancelar" del stub.
    expect(
      screen.queryByRole("button", { name: /^editar$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^cancelar$/i }),
    ).not.toBeInTheDocument();
  });

  it("admin viewing a past mesa SÍ ve los controles del host (override)", async () => {
    setupTable(
      makeTable({
        date: new Date(Date.now() - 86400000).toISOString(),
        host: { _id: "host1", username: "host1" },
      }),
    );
    renderTableDetail({
      user: { _id: "host1", username: "host1", isAdmin: true },
    });
    await screen.findByRole("heading", { name: "Catán" });
    expect(screen.getByText(/mesa finalizada\./i)).toBeInTheDocument();
    // Como admin, sigue viendo Editar + Cancelar del stub.
    expect(screen.getByRole("button", { name: /editar/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Cancelar$/i }),
    ).toBeInTheDocument();
  });

  it("admin viewing a table sees the admin banner", async () => {
    setupTable(makeTable());
    renderTableDetail({
      user: { _id: "admin1", username: "admin1", isAdmin: true },
    });
    await screen.findByRole("heading", { name: "Catán" });
    expect(
      screen.getByText(/viendo esta mesa como administrador/i),
    ).toBeInTheDocument();
  });

  // -- Meta + content ----------------------------------------------------

  it("shows the seat ratio in the meta row and stub", async () => {
    setupTable(
      makeTable({
        maxPlayers: 4,
        players: [
          { _id: "a", username: "a", avatar: { url: "", publicId: "" } },
        ],
      }),
    );
    renderTableDetail();
    await screen.findByRole("heading", { name: "Catán" });
    // 2/5 (host + 1 player out of max + 1) appears in meta cell AND stub.
    expect(screen.getAllByText("2/5").length).toBeGreaterThan(0);
    expect(screen.getByText(/3 lugares libres/i)).toBeInTheDocument();
  });

  it("host on a private table sees solicitudes pendientes section", async () => {
    setupTable(
      makeTable({
        privacy: "private",
        host: {
          _id: "host1",
          username: "host1",
          avatar: { url: "", publicId: "" },
        },
        pendingRequests: [
          {
            _id: "r1",
            username: "requester1",
            avatar: { url: "", publicId: "" },
          },
        ],
      }),
    );
    renderTableDetail({
      user: { _id: "host1", username: "host1", isAdmin: false },
    });
    await screen.findByRole("heading", { name: "Catán" });
    expect(screen.getByText(/solicitudes pendientes/i)).toBeInTheDocument();
    expect(screen.getByText("requester1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /aceptar/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /rechazar/i }),
    ).toBeInTheDocument();
  });

  it("renders the table-map SVG component", async () => {
    setupTable(makeTable());
    renderTableDetail();
    await screen.findByRole("heading", { name: "Catán" });
    expect(screen.getByTestId("table-map")).toBeInTheDocument();
  });

  it("renders the player row for host + each player + empty seat rows", async () => {
    setupTable(
      makeTable({
        host: {
          _id: "host1",
          username: "theHost",
          avatar: { url: "", publicId: "" },
        },
        players: [
          { _id: "p1", username: "player1", avatar: { url: "", publicId: "" } },
          { _id: "p2", username: "player2", avatar: { url: "", publicId: "" } },
        ],
      }),
    );
    renderTableDetail();
    await screen.findByRole("heading", { name: "Catán" });
    expect(screen.getByText("theHost")).toBeInTheDocument();
    expect(screen.getByText("player1")).toBeInTheDocument();
    expect(screen.getByText("player2")).toBeInTheDocument();
    // 2 empty seats (maxPlayers=4 - 2 players = 2 empty)
    expect(screen.getAllByText(/lugar libre/i).length).toBe(2);
  });

  // El chat se movió al stub del aside (con InfoTooltip de privacidad), así
  // que la mobile tab bar ya no incluye "CHAT" — sólo alterna entre Fotos y
  // Comentarios en el main column. El chat aparece debajo del stub en mobile.
  it("participant sees mobile tab bar (Fotos / Comentarios)", async () => {
    setupTable(
      makeTable({
        players: [{ _id: "me", username: "me" }],
      }),
    );
    renderTableDetail({ user: { _id: "me", username: "me", isAdmin: false } });
    await screen.findByRole("heading", { name: "Catán" });
    expect(
      screen.queryByRole("button", { name: "CHAT" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fotos" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Comentarios" }),
    ).toBeInTheDocument();
  });

  // -- Interactions ------------------------------------------------------

  it('guest clicking "Unirme a la mesa" triggers join (POST /join)', async () => {
    const joined = vi.fn();
    setupTable(makeTable());
    server.use(
      http.post("/api/tables/:id/join", () => {
        joined();
        return HttpResponse.json({
          table: {
            ...makeTable(),
            players: [{ _id: "other", username: "other" }],
          },
        });
      }),
    );
    renderTableDetail({
      user: { _id: "other", username: "other", isAdmin: false },
    });
    await screen.findByRole("heading", { name: "Catán" });
    fireEvent.click(screen.getByRole("button", { name: /unirme a la mesa/i }));
    await waitFor(() => expect(joined).toHaveBeenCalled());
  });

  it("host clicking 'Editar' navigates to /mesas/:id/editar (no crash)", async () => {
    setupTable(
      makeTable({
        host: { _id: "host1", username: "host1" },
      }),
    );
    renderTableDetail({
      user: { _id: "host1", username: "host1", isAdmin: false },
    });
    await screen.findByRole("heading", { name: "Catán" });
    fireEvent.click(screen.getByRole("button", { name: /editar/i }));
  });

  it("host 'Cancelar' button opens inline confirm popover", async () => {
    setupTable(
      makeTable({
        host: { _id: "host1", username: "host1" },
      }),
    );
    renderTableDetail({
      user: { _id: "host1", username: "host1", isAdmin: false },
    });
    await screen.findByRole("heading", { name: "Catán" });
    fireEvent.click(screen.getByRole("button", { name: /^Cancelar$/i }));
    expect(screen.getByText(/cancelar esta mesa\?/i)).toBeInTheDocument();
  });

  it("player 'Abandonar' opens inline confirm popover", async () => {
    setupTable(
      makeTable({
        players: [{ _id: "me", username: "me" }],
      }),
    );
    renderTableDetail({ user: { _id: "me", username: "me", isAdmin: false } });
    await screen.findByRole("heading", { name: "Catán" });
    fireEvent.click(screen.getByRole("button", { name: /abandonar mesa/i }));
    expect(screen.getByText(/abandonar\?/i)).toBeInTheDocument();
  });

  it("clicking the back button does not crash", async () => {
    setupTable(makeTable());
    renderTableDetail();
    await screen.findByRole("heading", { name: "Catán" });
    fireEvent.click(screen.getByRole("button", { name: /volver/i }));
  });

  it('guest with pending request clicking "Cancelar solicitud" calls DELETE /request', async () => {
    const cancelled = vi.fn();
    setupTable(
      makeTable({
        pendingRequests: [{ _id: "me", username: "me" }],
      }),
    );
    server.use(
      http.delete("/api/tables/:id/request", () => {
        cancelled();
        return HttpResponse.json({
          table: { ...makeTable(), pendingRequests: [] },
        });
      }),
    );
    renderTableDetail({ user: { _id: "me", username: "me", isAdmin: false } });
    await screen.findByRole("heading", { name: "Catán" });
    fireEvent.click(
      screen.getByRole("button", { name: /cancelar solicitud/i }),
    );
    await waitFor(() => expect(cancelled).toHaveBeenCalled());
  });

  it('guest clicking "Seguir mesa" calls POST /follow', async () => {
    const followed = vi.fn();
    setupTable(makeTable());
    server.use(
      http.post("/api/tables/:id/follow", () => {
        followed();
        return HttpResponse.json({ followers: ["other"] });
      }),
    );
    renderTableDetail({
      user: { _id: "other", username: "other", isAdmin: false },
    });
    await screen.findByRole("heading", { name: "Catán" });
    fireEvent.click(screen.getByRole("button", { name: /seguir mesa/i }));
    await waitFor(() => expect(followed).toHaveBeenCalled());
  });

  it("host clicking accept on a pending request calls POST /requests/:userId/accept", async () => {
    const accepted = vi.fn();
    setupTable(
      makeTable({
        privacy: "private",
        host: { _id: "host1", username: "host1" },
        pendingRequests: [{ _id: "r1", username: "requester1" }],
      }),
    );
    server.use(
      http.post("/api/tables/:id/requests/:userId/accept", () => {
        accepted();
        return HttpResponse.json({
          ...makeTable({
            privacy: "private",
            host: { _id: "host1", username: "host1" },
          }),
          pendingRequests: [],
        });
      }),
    );
    renderTableDetail({
      user: { _id: "host1", username: "host1", isAdmin: false },
    });
    await screen.findByRole("heading", { name: "Catán" });
    fireEvent.click(screen.getByRole("button", { name: /aceptar/i }));
    await waitFor(() => expect(accepted).toHaveBeenCalled());
  });

  it('anon clicking "Iniciá sesión para unirte" opens the login prompt', async () => {
    setupTable(makeTable());
    renderTableDetail({ user: null });
    await screen.findByRole("heading", { name: "Catán" });
    fireEvent.click(
      screen.getByRole("button", { name: /iniciá sesión para unirte/i }),
    );
    expect(screen.getByTestId("login-prompt")).toBeInTheDocument();
  });
});
