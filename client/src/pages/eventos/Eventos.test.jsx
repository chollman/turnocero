import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));

// EventoForm internamente usa PlaceAutocomplete que carga Google Maps;
// lo mockeamos para que el form real pueda renderizarse en jsdom.
vi.mock("../../components/shared/PlaceAutocomplete", () => ({
  default: ({ value, onChange, placeholder }) => (
    <input
      data-testid="place-autocomplete"
      aria-label="lugar"
      value={value || ""}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

// DateTimePicker es un componente custom complejo con popover. Lo mockeamos
// para que estos tests puedan llenar la fecha como un input regular.
vi.mock("../../components/shared/DateTimePicker", () => ({
  default: ({ value, onChange, id, name, required }) => (
    <input
      id={id}
      name={name}
      type="datetime-local"
      data-testid="datetime-picker"
      value={value || ""}
      onChange={(e) => onChange?.(e.target.value)}
      aria-required={required || undefined}
    />
  ),
}));

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
import { useNotifications } from "../../context/NotificationContext";

function renderPage({ user = { _id: "me", username: "me" }, addToast = vi.fn() } = {}) {
  useAuth.mockReturnValue({ user });
  useNotifications.mockReturnValue({ addToast });
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <Eventos />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

// Abre el popover de ListFilters. Los chips y el slider de distancia viven
// dentro de ese popover (no en línea), así que cualquier test que interactúe
// con ellos debe abrirlo primero.
function openFilters() {
  fireEvent.click(screen.getByRole("button", { name: /^filtros/i }));
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

  it("M3 — escribir en el input de búsqueda manda ?search= debounced", async () => {
    let lastSearch = null;
    let calls = 0;
    server.use(
      http.get("/api/eventos", ({ request }) => {
        calls += 1;
        const url = new URL(request.url);
        lastSearch = url.searchParams.get("search");
        return HttpResponse.json({ eventos: [], page: 1, pages: 0, total: 0 });
      }),
    );
    renderPage();
    const input = await screen.findByLabelText(/buscar eventos por nombre/i);
    fireEvent.change(input, { target: { value: "Catan" } });
    // Debounce 300ms — esperamos a que dispare un fetch con ?search=
    await waitFor(() => expect(lastSearch).toBe("Catan"));
    expect(calls).toBeGreaterThan(1); // al menos 1 fetch inicial + 1 con search
  });

  it("dispara un toast de error cuando /api/eventos falla (regresión: silent catch dejaba al user sin feedback)", async () => {
    server.use(
      http.get("/api/eventos", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    const addToast = vi.fn();
    renderPage({ addToast });
    await waitFor(() => expect(addToast).toHaveBeenCalled());
    const call = addToast.mock.calls[0][0];
    expect(call.type).toBe("error");
    expect(call.title).toMatch(/no pudimos cargar/i);
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
    openFilters();
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
    openFilters();
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

  it("persists filter selection via localStorage", async () => {
    renderPage({ user: { _id: "me", isAdmin: false } });
    await screen.findByText("Open House");
    openFilters();
    fireEvent.click(screen.getByRole("button", { name: /cerrados/i }));
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem("turnocero_eventos_filter")),
      ).toBe("closed"),
    );
  });

  it("reads stored filter on mount and requests it from the server", async () => {
    let lastStatus = "sentinel";
    server.use(
      http.get("/api/eventos", ({ request }) => {
        const url = new URL(request.url);
        lastStatus = url.searchParams.get("status");
        return HttpResponse.json({ eventos: [], page: 1, pages: 1, total: 0 });
      }),
    );
    localStorage.setItem(
      "turnocero_eventos_filter",
      JSON.stringify("closed"),
    );
    renderPage({ user: { _id: "me", isAdmin: false } });
    await waitFor(() => expect(lastStatus).toBe("closed"));
  });

  it("resets stored filter to 'open' when it is no longer visible (e.g., 'draft' for non-admin)", async () => {
    localStorage.setItem(
      "turnocero_eventos_filter",
      JSON.stringify("draft"),
    );
    let lastStatus = "sentinel";
    server.use(
      http.get("/api/eventos", ({ request }) => {
        const url = new URL(request.url);
        lastStatus = url.searchParams.get("status");
        return HttpResponse.json({ eventos: [], page: 1, pages: 1, total: 0 });
      }),
    );
    renderPage({ user: { _id: "me", isAdmin: false } });
    // Should fall back to 'open' (draft is admin-only)
    await waitFor(() => expect(lastStatus).toBe("open"));
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem("turnocero_eventos_filter")),
      ).toBe("open"),
    );
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
    openFilters();
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
    await screen.findByText("Futuro A");
    openFilters();
    fireEvent.click(screen.getByRole("button", { name: /^todos$/i }));
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
    openFilters();
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
    openFilters();
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
    // Llenar título, fecha y lugar (los 3 son obligatorios)
    fireEvent.change(await screen.findByLabelText(/título/i), {
      target: { value: "Mi Draft" },
    });
    fireEvent.change(screen.getByLabelText(/fecha y hora/i), {
      target: { value: "2027-01-01T20:00" },
    });
    fireEvent.change(screen.getByLabelText(/^lugar$/i), {
      target: { value: "Bar Pepe" },
    });
    // Cambiar status a draft para crear un draft — ahora es un chip clickeable.
    fireEvent.click(screen.getByRole("radio", { name: /borrador/i }));
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

  it("renders the radius slider + step buttons for logged-in users", async () => {
    renderPage({ user: { _id: "me", direccion: { texto: "CABA", lat: -34.6, lng: -58.4 } } });
    await screen.findByText("Open House");
    openFilters();
    expect(screen.getByLabelText(/radio máximo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /disminuir radio/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /aumentar radio/i })).toBeInTheDocument();
  });

  it("shows the 'Agregá tu dirección' CTA and disables controls when user has no direccion", async () => {
    renderPage({ user: { _id: "me" } });
    await screen.findByText("Open House");
    openFilters();
    expect(screen.getByText(/agregá tu dirección/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /tu perfil/i })).toHaveAttribute("href", "/perfil");
    expect(screen.getByLabelText(/radio máximo/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /disminuir radio/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /aumentar radio/i })).toBeDisabled();
  });

  it("sends ?maxDistanceKm after the debounce when the slider moves", async () => {
    let lastUrl = null;
    server.use(
      http.get("/api/eventos", ({ request }) => {
        lastUrl = request.url;
        return HttpResponse.json({
          eventos: [makeEvento({ _id: "a", title: "Cercano" })],
          page: 1,
          pages: 1,
          total: 1,
        });
      }),
    );
    renderPage({ user: { _id: "me", direccion: { texto: "CABA", lat: -34.6, lng: -58.4 } } });
    await screen.findByText("Cercano");
    openFilters();

    fireEvent.change(screen.getByLabelText(/radio máximo/i), { target: { value: "25" } });
    expect(await screen.findByText("25 km")).toBeInTheDocument();
    await waitFor(
      () => {
        expect(lastUrl).toMatch(/maxDistanceKm=25/);
      },
      { timeout: 1500 },
    );
  });

  it("does NOT send maxDistanceKm when the slider stays at 0", async () => {
    let lastUrl = null;
    server.use(
      http.get("/api/eventos", ({ request }) => {
        lastUrl = request.url;
        return HttpResponse.json({ eventos: [], page: 1, pages: 1, total: 0 });
      }),
    );
    renderPage({ user: { _id: "me", direccion: { texto: "CABA", lat: -34.6, lng: -58.4 } } });
    await waitFor(() => expect(lastUrl).not.toBeNull());
    expect(lastUrl).not.toMatch(/maxDistanceKm/);
  });

  it('"+" / "−" buttons step the radius by 1 km and clamp at the bounds', async () => {
    renderPage({ user: { _id: "me", direccion: { texto: "CABA", lat: -34.6, lng: -58.4 } } });
    await screen.findByRole("button", { name: /^filtros/i });
    openFilters();
    const plus = await screen.findByRole("button", { name: /aumentar radio/i });
    fireEvent.click(plus);
    expect(await screen.findByText("1 km")).toBeInTheDocument();
    fireEvent.click(plus);
    fireEvent.click(plus);
    expect(await screen.findByText("3 km")).toBeInTheDocument();

    const minus = screen.getByRole("button", { name: /disminuir radio/i });
    fireEvent.click(minus);
    fireEvent.click(minus);
    fireEvent.click(minus);
    expect(await screen.findByText(/sin límite/i)).toBeInTheDocument();
    expect(minus).toBeDisabled();

    // Push the slider to the max and check the "+" disables.
    fireEvent.change(screen.getByLabelText(/radio máximo/i), { target: { value: "100" } });
    expect(await screen.findByText("100 km")).toBeInTheDocument();
    expect(plus).toBeDisabled();
  });

  it("crear un evento NO lo duplica si el socket emit llega antes que la response (regresión)", async () => {
    localStorage.setItem("token", "fake");
    const newEvento = makeEvento({
      _id: "new1",
      title: "Recién Creado",
      status: "open",
    });

    // Delay la POST response para garantizar que el socket llegue primero
    // (caso típico en localhost: el broadcast Socket.IO es ~instantáneo, el
    // HTTP response viaja por el mismo ciclo pero tarda más).
    let resolvePost;
    const postPromise = new Promise((resolve) => { resolvePost = resolve; });

    server.use(
      http.get("/api/eventos", () =>
        HttpResponse.json({ eventos: [], page: 1, pages: 1, total: 0 }),
      ),
      http.post("/api/eventos", async () => {
        await postPromise;
        return HttpResponse.json(newEvento);
      }),
    );

    renderPage({ user: { _id: "admin1", isAdmin: true } });
    // Esperar a que cargue la lista vacía.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /nuevo evento/i })).toBeInTheDocument();
    });

    // Abrir el form y submitearlo con datos mínimos.
    fireEvent.click(screen.getByRole("button", { name: /nuevo evento/i }));
    fireEvent.change(await screen.findByLabelText(/título/i), {
      target: { value: "Recién Creado" },
    });
    fireEvent.change(screen.getByLabelText(/fecha y hora/i), {
      target: { value: "2027-01-01T20:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crear evento/i }));

    // POST queda colgado en postPromise. Disparamos el socket emit primero
    // (simulando el race condition real).
    await triggerSocket("evento:created", { evento: newEvento });

    // El evento ya debería estar en la lista por el socket.
    expect(screen.getByText("Recién Creado")).toBeInTheDocument();

    // Ahora resolvemos el POST. handleCreate continúa y intenta agregar
    // — sin el dedup que agregamos, aparecía DOS veces.
    resolvePost();

    await waitFor(() => {
      expect(screen.getAllByText("Recién Creado")).toHaveLength(1);
    });
  });
});
