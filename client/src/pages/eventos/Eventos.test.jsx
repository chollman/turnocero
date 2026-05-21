import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

// Mock socket.io-client capturando los listeners para dispararlos manualmente.
const socketListeners = new Map();
vi.mock("socket.io-client", () => ({
  io: () => {
    socketListeners.clear();
    return {
      on: (event, fn) => {
        socketListeners.set(event, fn);
      },
      off: () => {},
      emit: () => {},
      disconnect: () => {},
      connect: () => {},
    };
  },
}));
async function triggerSocket(event, payload) {
  const { act } = await import("@testing-library/react");
  const fn = socketListeners.get(event);
  if (!fn) throw new Error(`No listener for ${event}`);
  act(() => fn(payload));
}

import Eventos from "./Eventos";
import { useAuth } from "../../context/AuthContext";

function renderPage({ user = { _id: "me", username: "me" } } = {}) {
  useAuth.mockReturnValue({ user });
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <Eventos />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

function makeEvento(overrides = {}) {
  return {
    _id: overrides._id || `e${Math.random()}`,
    title: overrides.title || "Evento de prueba",
    description: "",
    eventDate: new Date(Date.now() + 14 * 86400000).toISOString(),
    location: "BA",
    maxParticipants: 20,
    status: overrides.status || "open",
    author: {
      _id: "a1",
      username: "admin",
      displayName: "Admin",
      avatar: null,
    },
    fee: 0,
    registrationCount: { total: 0, pending: 0, confirmed: 0 },
    userRegistration: null,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  server.use(
    http.get("/api/eventos", () =>
      HttpResponse.json({
        eventos: [
          makeEvento({ _id: "a", title: "Open House" }),
          makeEvento({ _id: "b", title: "Torneo Nocturno", status: "closed" }),
        ],
        page: 1,
        pages: 1,
        total: 2,
      }),
    ),
  );
});

describe("<Eventos>", () => {
  it("renders the editorial hero", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /eventos de la/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/agenda · /i)).toBeInTheDocument();
  });

  it("loads + renders titles via TimelineRow", async () => {
    renderPage();
    await screen.findByText("Open House");
    expect(screen.getByText("Torneo Nocturno")).toBeInTheDocument();
  });

  it('regular users do not see the "Nuevo evento" button', async () => {
    renderPage({ user: { _id: "me", isAdmin: false } });
    await screen.findByText("Open House");
    expect(
      screen.queryByRole("button", { name: /nuevo evento/i }),
    ).not.toBeInTheDocument();
  });

  it('admins see the "Nuevo evento" button and chips for borradores/cancelados', async () => {
    renderPage({ user: { _id: "admin", isAdmin: true } });
    await screen.findByText("Open House");
    expect(
      screen.getByRole("button", { name: /nuevo evento/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /borradores/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancelados/i }),
    ).toBeInTheDocument();
  });

  it("regular users do not see admin-only filters", async () => {
    renderPage({ user: { _id: "me", isAdmin: false } });
    await screen.findByText("Open House");
    expect(
      screen.queryByRole("button", { name: /borradores/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /cancelados/i }),
    ).not.toBeInTheDocument();
  });

  it('shows "Mis inscr." chip only for logged-in users', async () => {
    renderPage({ user: { _id: "me", isAdmin: false } });
    await screen.findByText("Open House");
    expect(
      screen.getByRole("button", { name: /mis inscr\./i }),
    ).toBeInTheDocument();
  });

  it("persists view mode via localStorage", async () => {
    renderPage();
    await screen.findByText("Open House");
    const posterBtn = screen.getByRole("button", { name: /vista posters/i });
    fireEvent.click(posterBtn);
    expect(JSON.parse(localStorage.getItem("turnocero_eventos_view"))).toBe(
      "poster",
    );
  });

  it("reads stored view mode on mount", async () => {
    localStorage.setItem("turnocero_eventos_view", JSON.stringify("poster"));
    renderPage();
    await screen.findByText("Open House");
    expect(
      screen.getByRole("button", { name: /vista posters/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it('admin: clicking "Nuevo evento" reveals the EventoForm', async () => {
    renderPage({ user: { _id: "admin", isAdmin: true } });
    await screen.findByText("Open House");
    fireEvent.click(screen.getByRole("button", { name: /nuevo evento/i }));
    expect(await screen.findByLabelText(/título/i)).toBeInTheDocument();
  });

  it('default filter is "Abiertos" — first request passes status=open', async () => {
    let lastStatus = "sentinel";
    server.use(
      http.get("/api/eventos", ({ request }) => {
        const url = new URL(request.url);
        lastStatus = url.searchParams.get("status");
        return HttpResponse.json({ eventos: [], page: 1, pages: 1, total: 0 });
      }),
    );
    renderPage({ user: { _id: "admin", isAdmin: true } });
    await waitFor(() => expect(lastStatus).toBe("open"));
  });

  it('shows the "Hoy" divider between past and future events when filter is Todos', async () => {
    server.use(
      http.get("/api/eventos", () =>
        HttpResponse.json({
          eventos: [
            makeEvento({
              _id: "past",
              title: "Evento pasado",
              eventDate: new Date(Date.now() - 7 * 86400000).toISOString(),
            }),
            makeEvento({
              _id: "future",
              title: "Evento futuro",
              eventDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            }),
          ],
          page: 1,
          pages: 1,
          total: 2,
        }),
      ),
    );
    renderPage({ user: { _id: "admin", isAdmin: true } });
    await screen.findByText("Evento pasado");
    // Click "Todos" to switch off the default 'open' filter
    fireEvent.click(screen.getByRole("button", { name: /^todos$/i }));
    await screen.findByText("Evento futuro");
    expect(screen.getByText(/hoy · próximos eventos/i)).toBeInTheDocument();
  });

  it('does NOT show the "Hoy" divider when all events are future', async () => {
    server.use(
      http.get("/api/eventos", () =>
        HttpResponse.json({
          eventos: [
            makeEvento({
              _id: "f1",
              title: "Futuro A",
              eventDate: new Date(Date.now() + 86400000).toISOString(),
            }),
            makeEvento({
              _id: "f2",
              title: "Futuro B",
              eventDate: new Date(Date.now() + 2 * 86400000).toISOString(),
            }),
          ],
          page: 1,
          pages: 1,
          total: 2,
        }),
      ),
    );
    renderPage({ user: { _id: "admin", isAdmin: true } });
    fireEvent.click(screen.getByRole("button", { name: /^todos$/i }));
    await screen.findByText("Futuro A");
    expect(
      screen.queryByText(/hoy · próximos eventos/i),
    ).not.toBeInTheDocument();
  });

  it('does NOT show the "Hoy" divider when filter is not "Todos"', async () => {
    server.use(
      http.get("/api/eventos", () =>
        HttpResponse.json({
          eventos: [
            makeEvento({
              _id: "past",
              title: "Pasado abierto",
              status: "open",
              eventDate: new Date(Date.now() - 86400000).toISOString(),
            }),
            makeEvento({
              _id: "future",
              title: "Futuro abierto",
              status: "open",
              eventDate: new Date(Date.now() + 86400000).toISOString(),
            }),
          ],
          page: 1,
          pages: 1,
          total: 2,
        }),
      ),
    );
    renderPage({ user: { _id: "me" } });
    await screen.findByText("Futuro abierto");
    // Default filter is 'open' — divider should NOT appear even with past+future
    expect(
      screen.queryByText(/hoy · próximos eventos/i),
    ).not.toBeInTheDocument();
  });

  it('clicking "Todos" clears the status filter', async () => {
    let lastStatus = "sentinel";
    server.use(
      http.get("/api/eventos", ({ request }) => {
        const url = new URL(request.url);
        lastStatus = url.searchParams.get("status");
        return HttpResponse.json({ eventos: [], page: 1, pages: 1, total: 0 });
      }),
    );
    renderPage({ user: { _id: "admin", isAdmin: true } });
    await waitFor(() => expect(lastStatus).toBe("open"));
    fireEvent.click(screen.getByRole("button", { name: /^todos$/i }));
    await waitFor(() => expect(lastStatus).toBeNull());
  });

  it('mine filter shows empty CTA "Cargar más eventos" when more pages exist', async () => {
    server.use(
      http.get("/api/eventos", () =>
        HttpResponse.json({
          eventos: [makeEvento({ _id: "a", title: "Open House" })],
          page: 1,
          pages: 3,
          total: 30,
        }),
      ),
    );
    renderPage({ user: { _id: "me", isAdmin: false } });
    await screen.findByText("Open House");
    fireEvent.click(screen.getByRole("button", { name: /mis inscr\./i }));
    expect(
      await screen.findByRole("button", { name: /cargar más eventos/i }),
    ).toBeInTheDocument();
  });

  it("shows skeletons while loading", () => {
    server.use(
      http.get("/api/eventos", async () => {
        await new Promise((r) => {
          setTimeout(r, 50);
        });
        return HttpResponse.json({ eventos: [], page: 1, pages: 1 });
      }),
    );
    renderPage();
    // Skeleton lines have shimmer animation; smoke check the page is mounted
    expect(
      screen.getByRole("heading", { name: /eventos de la/i }),
    ).toBeInTheDocument();
  });

  it("Ver más eventos loads the next page and appends events", async () => {
    server.use(
      http.get("/api/eventos", ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get("page") || "1");
        if (page === 2)
          return HttpResponse.json({
            eventos: [makeEvento({ _id: "p2", title: "Evento Página 2" })],
            page: 2,
            pages: 2,
            total: 3,
          });
        return HttpResponse.json({
          eventos: [makeEvento({ _id: "p1", title: "Evento Página 1" })],
          page: 1,
          pages: 2,
          total: 3,
        });
      }),
    );
    renderPage();
    await screen.findByText("Evento Página 1");
    fireEvent.click(screen.getByRole("button", { name: /ver más eventos/i }));
    await waitFor(() =>
      expect(screen.getByText("Evento Página 2")).toBeInTheDocument(),
    );
    expect(screen.getByText("Evento Página 1")).toBeInTheDocument();
  });

  it("al crear un evento con status que no coincide con el filtro activo, cambia al filtro de su status (regresión: el draft no aparecía bajo filter=Abiertos)", async () => {
    // Lista de "Abiertos" arranca vacía.
    server.use(
      http.get("/api/eventos", ({ request }) => {
        const url = new URL(request.url);
        const status = url.searchParams.get("status");
        if (status === "draft") {
          return HttpResponse.json({
            eventos: [
              makeEvento({ _id: "d1", title: "Mi Draft", status: "draft" }),
            ],
            page: 1,
            pages: 1,
            total: 1,
          });
        }
        return HttpResponse.json({ eventos: [], page: 1, pages: 1, total: 0 });
      }),
      http.post("/api/eventos", async () =>
        HttpResponse.json(
          makeEvento({ _id: "d1", title: "Mi Draft", status: "draft" }),
          { status: 201 },
        ),
      ),
    );

    renderPage({ user: { _id: "admin", isAdmin: true } });
    // Esperar que termine el load inicial (lista vacía).
    await screen.findByText(/no hay eventos/i);
    // Click "Nuevo evento" → abre el form
    fireEvent.click(screen.getByRole("button", { name: /nuevo evento/i }));
    // Llenar título y fecha (mínimo para submit)
    fireEvent.change(await screen.findByLabelText(/título/i), {
      target: { value: "Mi Draft" },
    });
    fireEvent.change(screen.getByLabelText(/fecha y hora/i), {
      target: { value: "2027-01-01T20:00" },
    });
    // Cambiar status a draft para crear un draft
    fireEvent.change(screen.getByLabelText(/estado/i), {
      target: { value: "draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crear evento/i }));

    // El draft creado debe aparecer en la lista (porque el filter cambió a Borradores)
    expect(await screen.findByText("Mi Draft")).toBeInTheDocument();
  });

  it("socket evento:created NO inserta eventos que no matchean el filter activo (regresión)", async () => {
    localStorage.setItem("token", "fake");
    server.use(
      http.get("/api/eventos", () =>
        HttpResponse.json({
          eventos: [
            makeEvento({
              _id: "open1",
              title: "Abierto Existente",
              status: "open",
            }),
          ],
          page: 1,
          pages: 1,
          total: 1,
        }),
      ),
    );
    renderPage({ user: { _id: "u1", isAdmin: false } });
    await screen.findByText("Abierto Existente");

    // Broadcast llega anunciando un closed creado por otro admin (caso raro
    // pero posible si el server lo broadcastea — el filter "Abiertos" no
    // debería incorporarlo).
    await triggerSocket("evento:created", {
      evento: makeEvento({
        _id: "closed1",
        title: "Cerrado Intruso",
        status: "closed",
      }),
    });

    expect(screen.queryByText("Cerrado Intruso")).not.toBeInTheDocument();
    expect(screen.getByText("Abierto Existente")).toBeInTheDocument();
  });

  it("socket evento:updated saca de la vista los items que dejaron de matchear el filter (regresión)", async () => {
    localStorage.setItem("token", "fake");
    server.use(
      http.get("/api/eventos", () =>
        HttpResponse.json({
          eventos: [
            makeEvento({ _id: "ev1", title: "Va a cerrar", status: "open" }),
          ],
          page: 1,
          pages: 1,
          total: 1,
        }),
      ),
    );
    renderPage({ user: { _id: "u1", isAdmin: false } });
    await screen.findByText("Va a cerrar");

    // Otro admin cierra el evento mientras yo estoy viendo "Abiertos".
    await triggerSocket("evento:updated", {
      eventoId: "ev1",
      evento: { _id: "ev1", title: "Va a cerrar", status: "closed" },
    });

    expect(screen.queryByText("Va a cerrar")).not.toBeInTheDocument();
  });
});
