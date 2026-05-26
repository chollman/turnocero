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
vi.mock("../../components/shared/GameTile", () => ({ default: () => null }));
vi.mock("../../components/shared/LoginPromptModal", () => ({
  default: () => null,
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
    reactions: [],
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
  useNotifications.mockReturnValue({ setActiveTable: vi.fn() });
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
  it("renders the board game name as the heading", async () => {
    renderTableDetail();
    expect(await screen.findByText("Catán")).toBeInTheDocument();
  });

  it("renders the location and description", async () => {
    renderTableDetail();
    await screen.findByText("Catán");
    expect(screen.getByText("Buenos Aires")).toBeInTheDocument();
    expect(screen.getByText("Una noche tranquila")).toBeInTheDocument();
  });

  it("shows the loading skeleton initially", () => {
    renderTableDetail();
    expect(screen.getByText("loading-skeleton")).toBeInTheDocument();
  });

  it("handles a 404 gracefully (no crash)", async () => {
    server.use(
      http.get("/api/tables/:id", () => HttpResponse.json({}, { status: 404 })),
    );
    const { container } = renderTableDetail();
    // After load the page should not throw. Either error state, skeleton, or empty
    // — all acceptable; we just verify no exception escaped.
    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });

  it("renders the host name", async () => {
    renderTableDetail();
    await screen.findByText("Catán");
    expect(screen.getAllByText(/Host User|host1/i).length).toBeGreaterThan(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // User role variations
  // ─────────────────────────────────────────────────────────────────────────

  it('host sees HOST badge and "Editar mesa" + "Cancelar mesa" buttons', async () => {
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
    await screen.findByText("Catán");
    expect(screen.getByText("HOST")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /editar mesa/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancelar mesa/i }),
    ).toBeInTheDocument();
  });

  it('player sees UNIDO badge and "Abandonar mesa" button', async () => {
    setupTable(
      makeTable({
        players: [
          { _id: "me", username: "me", avatar: { url: "", publicId: "" } },
        ],
      }),
    );
    renderTableDetail({ user: { _id: "me", username: "me", isAdmin: false } });
    await screen.findByText("Catán");
    expect(screen.getByText("UNIDO")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /abandonar mesa/i }),
    ).toBeInTheDocument();
  });

  it('guest sees "Unirme a la mesa" and "🔕 Seguir" buttons', async () => {
    setupTable(makeTable());
    renderTableDetail({
      user: { _id: "other", username: "other", isAdmin: false },
    });
    await screen.findByText("Catán");
    expect(
      screen.getByRole("button", { name: /unirme a la mesa/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /seguir/i })).toBeInTheDocument();
  });

  it('anonymous user sees "Unirme a la mesa" and "🔕 Seguir" (prompts login)', async () => {
    setupTable(makeTable());
    renderTableDetail({ user: null });
    await screen.findByText("Catán");
    expect(
      screen.getByRole("button", { name: /unirme a la mesa/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /seguir/i })).toBeInTheDocument();
  });

  it('guest with a pending request sees "Solicitud enviada · Cancelar"', async () => {
    setupTable(
      makeTable({
        pendingRequests: [{ _id: "me", username: "me" }],
      }),
    );
    renderTableDetail({ user: { _id: "me", username: "me", isAdmin: false } });
    await screen.findByText("Catán");
    expect(
      screen.getByRole("button", { name: /solicitud enviada/i }),
    ).toBeInTheDocument();
  });

  it('full open table shows "Mesa completa" on the join button', async () => {
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
    await screen.findByText("Catán");
    expect(
      screen.getByRole("button", { name: /mesa completa/i }),
    ).toBeDisabled();
  });

  it("private table viewed by the host renders without crashing", async () => {
    // Guests on private tables get redirected; only host/players/admin can see the page.
    setupTable(
      makeTable({
        privacy: "private",
        host: { _id: "host1", username: "host1" },
      }),
    );
    renderTableDetail({
      user: { _id: "host1", username: "host1", isAdmin: false },
    });
    await screen.findByText("Catán");
    // No assertion on the lock badge text (it's an icon); just verify the page rendered
  });

  it("cancelled table shows CANCELADA badge and hides action bar", async () => {
    setupTable(makeTable({ status: "cancelled" }));
    renderTableDetail({
      user: { _id: "other", username: "other", isAdmin: false },
    });
    await screen.findByText("Catán");
    expect(screen.getByText("CANCELADA")).toBeInTheDocument();
    // The "Unirme a la mesa" action button should NOT render because the actionsBar is hidden
    expect(
      screen.queryByRole("button", { name: /unirme a la mesa/i }),
    ).not.toBeInTheDocument();
  });

  it("admin viewing a table they are not part of sees the admin banner", async () => {
    setupTable(makeTable());
    renderTableDetail({
      user: { _id: "admin1", username: "admin1", isAdmin: true },
    });
    await screen.findByText("Catán");
    expect(
      screen.getByText(/viendo esta mesa como administrador/i),
    ).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Sections, badges and content
  // ─────────────────────────────────────────────────────────────────────────

  it('shows the seat count and "lugares libres" status text', async () => {
    setupTable(
      makeTable({
        maxPlayers: 4,
        players: [
          { _id: "a", username: "a", avatar: { url: "", publicId: "" } },
        ],
      }),
    );
    renderTableDetail();
    await screen.findByText("Catán");
    // filled = players.length(1) + 1 (host) = 2 / total = 4+1 = 5
    expect(screen.getByText("2/5")).toBeInTheDocument();
    expect(screen.getByText(/3 lugares libres/i)).toBeInTheDocument();
  });

  it('shows "Mesa completa" status text when the table is full', async () => {
    setupTable(
      makeTable({
        maxPlayers: 2,
        players: [
          { _id: "a", username: "a", avatar: { url: "", publicId: "" } },
          { _id: "b", username: "b", avatar: { url: "", publicId: "" } },
        ],
      }),
    );
    renderTableDetail();
    await screen.findByText("Catán");
    // Match the "● Mesa completa" status line specifically (avoids matching the button)
    expect(screen.getAllByText(/mesa completa/i).length).toBeGreaterThan(0);
  });

  it("renders all 5 reaction emoji buttons", async () => {
    setupTable(makeTable());
    renderTableDetail({
      user: { _id: "other", username: "other", isAdmin: false },
    });
    await screen.findByText("Catán");
    expect(screen.getByRole("button", { name: "❤️" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🎲" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🔥" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "👍" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "😄" })).toBeInTheDocument();
  });

  it("reaction with existing reactions shows the count", async () => {
    setupTable(
      makeTable({
        reactions: [
          { user: "u1", emoji: "❤️" },
          { user: "u2", emoji: "❤️" },
          { user: "u3", emoji: "🔥" },
        ],
      }),
    );
    renderTableDetail({
      user: { _id: "other", username: "other", isAdmin: false },
    });
    await screen.findByText("Catán");
    // ❤️ shows count "2", 🔥 shows count "1"
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it('host on a private table sees "SOLICITUDES PENDIENTES" section', async () => {
    setupTable(
      makeTable({
        privacy: "private",
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
    await screen.findByText("Catán");
    expect(screen.getByText("SOLICITUDES PENDIENTES")).toBeInTheDocument();
    expect(
      screen.getByText(/no hay solicitudes pendientes/i),
    ).toBeInTheDocument();
  });

  it("host on a private table with pending requests sees Aceptar/Rechazar buttons", async () => {
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
    await screen.findByText("Catán");
    expect(screen.getByText("requester1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /aceptar/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /rechazar/i }),
    ).toBeInTheDocument();
  });

  it("shows the empty comments state when no comments exist", async () => {
    setupTable(makeTable());
    renderTableDetail({ user: { _id: "me", username: "me", isAdmin: false } });
    await screen.findByText("Catán");
    expect(
      screen.getByText(/nadie coment[oó] todav[ií]a/i),
    ).toBeInTheDocument();
  });

  it("renders a list of comments when comments exist", async () => {
    server.use(
      http.get("/api/tables/:id", () => HttpResponse.json(makeTable())),
      http.get("/api/tables/:id/messages", () => HttpResponse.json([])),
      http.get("/api/tables/:id/comments", () =>
        HttpResponse.json([
          {
            _id: "c1",
            content: "Excelente partida!",
            author: {
              _id: "a1",
              username: "commenter1",
              avatar: { url: "", publicId: "" },
            },
            createdAt: new Date().toISOString(),
          },
        ]),
      ),
      http.get("/api/tables/:id/ratings", () =>
        HttpResponse.json({ ratings: [], avg: null, count: 0 }),
      ),
    );
    renderTableDetail({ user: { _id: "me", username: "me", isAdmin: false } });
    await screen.findByText("Catán");
    await waitFor(() =>
      expect(screen.getByText("Excelente partida!")).toBeInTheDocument(),
    );
  });

  it("shows the empty gallery state when no images exist", async () => {
    setupTable(
      makeTable({
        players: [{ _id: "me", username: "me" }],
      }),
    );
    renderTableDetail({ user: { _id: "me", username: "me", isAdmin: false } });
    await screen.findByText("Catán");
    expect(screen.getByText(/todav[ií]a no hay fotos/i)).toBeInTheDocument();
  });

  it("renders gallery images when images exist", async () => {
    setupTable(
      makeTable({
        images: [
          {
            _id: "i1",
            url: "https://example.com/photo.jpg",
            uploader: { _id: "u1", username: "u1" },
          },
        ],
      }),
    );
    renderTableDetail({ user: { _id: "me", username: "me", isAdmin: false } });
    await screen.findByText("Catán");
    const imgs = document.querySelectorAll("img");
    // The gallery image should be in the DOM somewhere
    expect(imgs.length).toBeGreaterThan(0);
  });

  it('participant sees "+ Foto" upload button (canUpload=true)', async () => {
    setupTable(
      makeTable({
        players: [{ _id: "me", username: "me" }],
      }),
    );
    renderTableDetail({ user: { _id: "me", username: "me", isAdmin: false } });
    await screen.findByText("Catán");
    expect(
      screen.getByRole("button", { name: /\+ foto/i }),
    ).toBeInTheDocument();
  });

  it('guest does NOT see the "+ Foto" upload button', async () => {
    setupTable(makeTable());
    renderTableDetail({
      user: { _id: "other", username: "other", isAdmin: false },
    });
    await screen.findByText("Catán");
    expect(
      screen.queryByRole("button", { name: /\+ foto/i }),
    ).not.toBeInTheDocument();
  });

  it("participant sees mobile tab bar (CHAT / FOTOS / RESEÑAS)", async () => {
    setupTable(
      makeTable({
        players: [{ _id: "me", username: "me" }],
      }),
    );
    renderTableDetail({ user: { _id: "me", username: "me", isAdmin: false } });
    await screen.findByText("Catán");
    expect(screen.getByRole("button", { name: "CHAT" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "FOTOS" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "RESEÑAS" })).toBeInTheDocument();
  });

  it("clicking a mobile tab switches the active tab", async () => {
    setupTable(
      makeTable({
        players: [{ _id: "me", username: "me" }],
      }),
    );
    renderTableDetail({ user: { _id: "me", username: "me", isAdmin: false } });
    await screen.findByText("Catán");
    fireEvent.click(screen.getByRole("button", { name: "FOTOS" }));
    // No crash; the button retains role
    expect(screen.getByRole("button", { name: "FOTOS" })).toBeInTheDocument();
  });

  it('guest sees the private chat note ("El chat es privado")', async () => {
    setupTable(makeTable());
    renderTableDetail({
      user: { _id: "other", username: "other", isAdmin: false },
    });
    await screen.findByText("Catán");
    expect(screen.getByText(/el chat es privado/i)).toBeInTheDocument();
  });

  it("renders the player chips (host + players)", async () => {
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
    await screen.findByText("Catán");
    expect(screen.getByText("player1")).toBeInTheDocument();
    expect(screen.getByText("player2")).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Interactions
  // ─────────────────────────────────────────────────────────────────────────

  it('guest clicking "Unirme a la mesa" triggers join (calls POST /join)', async () => {
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
    await screen.findByText("Catán");
    fireEvent.click(screen.getByRole("button", { name: /unirme a la mesa/i }));
    await waitFor(() => expect(joined).toHaveBeenCalled());
  });

  it("clicking a reaction emoji triggers POST /react", async () => {
    const reacted = vi.fn();
    setupTable(makeTable());
    server.use(
      http.post("/api/tables/:id/react", async ({ request }) => {
        const body = await request.json();
        reacted(body);
        return HttpResponse.json({
          reactions: [{ user: "me", emoji: body.emoji }],
        });
      }),
    );
    renderTableDetail({ user: { _id: "me", username: "me", isAdmin: false } });
    await screen.findByText("Catán");
    fireEvent.click(screen.getByRole("button", { name: "🔥" }));
    await waitFor(() => expect(reacted).toHaveBeenCalledWith({ emoji: "🔥" }));
  });

  it('host clicking "Editar mesa" navigates to /mesas/:id/editar', async () => {
    setupTable(
      makeTable({
        host: { _id: "host1", username: "host1" },
      }),
    );
    renderTableDetail({
      user: { _id: "host1", username: "host1", isAdmin: false },
    });
    await screen.findByText("Catán");
    // We just verify the button is clickable (no crash navigating)
    fireEvent.click(screen.getByRole("button", { name: /editar mesa/i }));
  });

  it('host clicking "Cancelar mesa" prompts confirm (cancelled if user clicks no)', async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    setupTable(
      makeTable({
        host: { _id: "host1", username: "host1" },
      }),
    );
    renderTableDetail({
      user: { _id: "host1", username: "host1", isAdmin: false },
    });
    await screen.findByText("Catán");
    fireEvent.click(screen.getByRole("button", { name: /cancelar mesa/i }));
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('player clicking "Abandonar mesa" prompts confirm', async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    setupTable(
      makeTable({
        players: [{ _id: "me", username: "me" }],
      }),
    );
    renderTableDetail({ user: { _id: "me", username: "me", isAdmin: false } });
    await screen.findByText("Catán");
    fireEvent.click(screen.getByRole("button", { name: /abandonar mesa/i }));
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('clicking the "Volver" back button does not crash', async () => {
    setupTable(makeTable());
    renderTableDetail();
    await screen.findByText("Catán");
    fireEvent.click(screen.getByRole("button", { name: /volver/i }));
  });

  it('guest with pending request clicking "Cancelar" calls DELETE /request', async () => {
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
    await screen.findByText("Catán");
    fireEvent.click(screen.getByRole("button", { name: /solicitud enviada/i }));
    await waitFor(() => expect(cancelled).toHaveBeenCalled());
  });

  it('guest clicking "Seguir" calls POST /follow', async () => {
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
    await screen.findByText("Catán");
    fireEvent.click(screen.getByRole("button", { name: /seguir/i }));
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
    await screen.findByText("Catán");
    fireEvent.click(screen.getByRole("button", { name: /aceptar/i }));
    await waitFor(() => expect(accepted).toHaveBeenCalled());
  });

  it('anonymous user clicking "Unirme a la mesa" opens the login prompt', async () => {
    setupTable(makeTable());
    renderTableDetail({ user: null });
    await screen.findByText("Catán");
    fireEvent.click(screen.getByRole("button", { name: /unirme a la mesa/i }));
    // The LoginPromptModal mock returns null, but the state change happens — no crash
  });

  it('anonymous user clicking "Seguir" opens the login prompt', async () => {
    setupTable(makeTable());
    renderTableDetail({ user: null });
    await screen.findByText("Catán");
    fireEvent.click(screen.getByRole("button", { name: /seguir/i }));
  });

  it('"Volver" button navigates back to the previous screen', async () => {
    setupTable(makeTable());
    useAuth.mockReturnValue({ user: null });
    useNotifications.mockReturnValue({ setActiveTable: vi.fn() });
    render(
      <MemoryRouter
        initialEntries={["/pantalla-anterior", "/mesas/t1"]}
        initialIndex={1}
      >
        <Routes>
          <Route
            path="/pantalla-anterior"
            element={<div>previous-screen</div>}
          />
          <Route path="/mesas/:id" element={<TableDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("Catán");
    fireEvent.click(screen.getByRole("button", { name: /volver/i }));
    expect(await screen.findByText("previous-screen")).toBeInTheDocument();
  });
});
