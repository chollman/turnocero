import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));

// Mock socket.io-client capturando los listeners para poder dispararlos
// manualmente desde los tests. `__lastSocket` siempre apunta al último socket
// creado, y `__emit(event, payload)` invoca el handler registrado.
const socketListeners = new Map();
let _lastSocket = null;
vi.mock("socket.io-client", () => ({
  io: () => {
    socketListeners.clear();
    const s = {
      on: (event, fn) => {
        socketListeners.set(event, fn);
      },
      off: () => {},
      emit: () => {},
      disconnect: () => {},
      connect: () => {},
    };
    _lastSocket = s;
    return s;
  },
}));

function triggerSocket(event, payload) {
  const fn = socketListeners.get(event);
  if (!fn) throw new Error(`No listener registered for ${event}`);
  act(() => fn(payload));
}

import EventoDetail from "./EventoDetail";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";

function makeEvento(overrides = {}) {
  return {
    _id: "e1",
    title: "Mi Evento",
    description: "Descripción del evento",
    conditions: "Llegar 15 min antes",
    fee: overrides.fee ?? 0,
    transferDetails: overrides.transferDetails || "Alias: turnocero",
    eventDate: new Date(Date.now() + 14 * 86400000).toISOString(),
    location: "Buenos Aires",
    maxParticipants: 20,
    image: null,
    status: overrides.status || "open",
    author: {
      _id: "a1",
      username: "organizer",
      displayName: "Organizer",
      avatar: null,
    },
    registrationCount: { total: 2, pending: 1, confirmed: 1 },
    userRegistration: null,
    confirmedRegistrations: [],
    ...overrides,
  };
}

function setupEvento(evento) {
  server.use(http.get("/api/eventos/:id", () => HttpResponse.json(evento)));
}

function renderDetail({
  user = null,
  eventoId = "e1",
  setActiveEvento = vi.fn(),
} = {}) {
  useAuth.mockReturnValue({ user });
  useNotifications.mockReturnValue({ setActiveEvento });
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/eventos/${eventoId}`]}>
        <Routes>
          <Route path="/eventos/:id" element={<EventoDetail />} />
          <Route path="/" element={<div>home</div>} />
          <Route path="/eventos" element={<div>eventos</div>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

beforeEach(() => {
  setupEvento(makeEvento());
});

describe("<EventoDetail>", () => {
  it('renders the title, description and "Gratis" label when fee=0', async () => {
    renderDetail();
    expect(
      await screen.findByRole("heading", { name: "Mi Evento" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Descripción del evento")).toBeInTheDocument();
    expect(screen.getAllByText("Gratis").length).toBeGreaterThan(0);
  });

  it("renders fee in pesos when paid", async () => {
    setupEvento(makeEvento({ fee: 3500 }));
    renderDetail();
    await screen.findByRole("heading", { name: "Mi Evento" });
    expect(screen.getAllByText(/\$3\.500/).length).toBeGreaterThan(0);
  });

  it('shows "Iniciá sesión" CTA when user is not logged in', async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "Mi Evento" });
    expect(
      screen.getByRole("button", { name: /iniciá sesión/i }),
    ).toBeInTheDocument();
  });

  it("shows confirmed state when userRegistration.status is confirmed", async () => {
    setupEvento(makeEvento({ userRegistration: { status: "confirmed" } }));
    renderDetail({ user: { _id: "me" } });
    expect(
      await screen.findByText(/inscripción confirmada/i),
    ).toBeInTheDocument();
  });

  it("shows pending state and allows cancel for pending registration", async () => {
    setupEvento(
      makeEvento({
        userRegistration: { status: "pending", comprobante: { url: "x" } },
      }),
    );
    renderDetail({ user: { _id: "me" } });
    await screen.findByText(/pendiente de revisión/i);
    expect(
      screen.getByRole("button", { name: /cancelar inscripción/i }),
    ).toBeInTheDocument();
  });

  it("shows host admin actions when current user is the author", async () => {
    setupEvento(
      makeEvento({
        author: { _id: "me", username: "me", displayName: "Me", avatar: null },
      }),
    );
    renderDetail({ user: { _id: "me" } });
    expect(
      await screen.findByRole("button", { name: /gestionar inscripciones/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editar/i })).toBeInTheDocument();
  });

  it("clicking Editar (host) reveals the EventoForm", async () => {
    setupEvento(
      makeEvento({
        author: { _id: "me", username: "me", displayName: "Me", avatar: null },
      }),
    );
    renderDetail({ user: { _id: "me" } });
    fireEvent.click(await screen.findByRole("button", { name: /editar/i }));
    expect(await screen.findByLabelText(/título/i)).toBeInTheDocument();
  });

  it("F5 — botón Compartir usa navigator.share con el short link", async () => {
    // El share resuelve el short link (get-or-create) antes de compartir.
    server.use(
      http.post("/api/shortlinks", () =>
        HttpResponse.json({ code: "Ev3nt0", path: "/x" }, { status: 201 }),
      ),
    );
    const shareMock = vi.fn().mockResolvedValue(undefined);
    const canShareMock = vi.fn().mockReturnValue(true);
    const originalShare = navigator.share;
    const originalCanShare = navigator.canShare;
    navigator.share = shareMock;
    navigator.canShare = canShareMock;
    try {
      renderDetail();
      await screen.findByRole("heading", { name: "Mi Evento" });
      fireEvent.click(
        screen.getByRole("button", { name: /compartir evento/i }),
      );
      await waitFor(() => expect(shareMock).toHaveBeenCalled());
      const call = shareMock.mock.calls[0][0];
      expect(call.title).toMatch(/Mi Evento/);
      expect(call.url).toMatch(/\/s\/Ev3nt0$/);
    } finally {
      navigator.share = originalShare;
      navigator.canShare = originalCanShare;
    }
  });

  it("F5 — sin navigator.share, cae a clipboard + toast", async () => {
    server.use(
      http.post("/api/shortlinks", () =>
        HttpResponse.json({ code: "Ev3nt0", path: "/x" }, { status: 201 }),
      ),
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalShare = navigator.share;
    const originalClipboard = navigator.clipboard;
    delete navigator.share;
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const addToast = vi.fn();
    useAuth.mockReturnValue({ user: null });
    useNotifications.mockReturnValue({
      setActiveEvento: vi.fn(),
      addToast,
    });
    try {
      render(
        <HelmetProvider>
          <MemoryRouter initialEntries={["/eventos/e1"]}>
            <Routes>
              <Route path="/eventos/:id" element={<EventoDetail />} />
            </Routes>
          </MemoryRouter>
        </HelmetProvider>,
      );
      await screen.findByRole("heading", { name: "Mi Evento" });
      fireEvent.click(
        screen.getByRole("button", { name: /compartir evento/i }),
      );
      await waitFor(() => expect(writeText).toHaveBeenCalled());
      expect(writeText.mock.calls[0][0]).toMatch(/\/s\/Ev3nt0$/);
      expect(addToast).toHaveBeenCalled();
    } finally {
      navigator.share = originalShare;
      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        configurable: true,
      });
    }
  });

  it("F5 — botón Compartir NO se muestra en eventos cancelled", async () => {
    setupEvento(makeEvento({ status: "cancelled" }));
    renderDetail();
    await screen.findByRole("heading", { name: "Mi Evento" });
    expect(
      screen.queryByRole("button", { name: /compartir evento/i }),
    ).not.toBeInTheDocument();
  });

  it("B6/B7 — un fallo del POST /inscribirse dispara toast global y re-throw para que el TicketStub no cierre el form", async () => {
    setupEvento(makeEvento({ fee: 0 }));
    server.use(
      http.post("/api/eventos/:id/inscribirse", () =>
        HttpResponse.json({ message: "no cupo" }, { status: 400 }),
      ),
    );
    const addToast = vi.fn();
    const setActiveEvento = vi.fn();
    useAuth.mockReturnValue({ user: { _id: "me" } });
    useNotifications.mockReturnValue({ setActiveEvento, addToast });
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/eventos/e1"]}>
          <Routes>
            <Route path="/eventos/:id" element={<EventoDetail />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );
    await screen.findByRole("heading", { name: "Mi Evento" });
    fireEvent.click(screen.getByRole("button", { name: /^inscribirme/i }));
    fireEvent.click(screen.getByRole("button", { name: /^confirmar$/i }));
    await waitFor(() => expect(addToast).toHaveBeenCalled());
    const call = addToast.mock.calls[0][0];
    expect(call.type).toBe("error");
    expect(call.title).toMatch(/no pudimos enviar/i);
    // El form sigue abierto (no se cerró) — el throw del handler signaliza
    // a TicketStub que no debe limpiar su state.
    expect(
      screen.getByRole("button", { name: /^confirmar$/i }),
    ).toBeInTheDocument();
  });

  it("setActiveEvento se llama con el id al montar y con null al desmontar (suprime toasts del evento activo y los marca leídos)", async () => {
    const setActiveEvento = vi.fn();
    const { unmount } = renderDetail({ eventoId: "e1", setActiveEvento });
    await screen.findByRole("heading", { name: "Mi Evento" });
    expect(setActiveEvento).toHaveBeenCalledWith("e1");
    setActiveEvento.mockClear();
    unmount();
    expect(setActiveEvento).toHaveBeenCalledWith(null);
  });

  it("renders 404 state when API returns 404", async () => {
    server.use(
      http.get("/api/eventos/:id", () =>
        HttpResponse.json({ message: "Not found" }, { status: 404 }),
      ),
    );
    renderDetail();
    expect(
      await screen.findByText(/evento no encontrado/i),
    ).toBeInTheDocument();
  });

  it('clicking "Inscribirme" on free event opens the inline form with no comprobante', async () => {
    renderDetail({ user: { _id: "me" } });
    fireEvent.click(
      await screen.findByRole("button", { name: /^inscribirme/i }),
    );
    expect(screen.queryByText(/comprobante \*/i)).not.toBeInTheDocument();
  });

  it("renders the metastrip with cuándo, dónde, inscripción, cupo", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "Mi Evento" });
    expect(screen.getByText(/cuándo/i)).toBeInTheDocument();
    expect(screen.getByText(/dónde/i)).toBeInTheDocument();
    expect(screen.getAllByText(/inscripción/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/cupo/i).length).toBeGreaterThan(0);
  });

  it("renders the host card with author display name", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "Mi Evento" });
    expect(screen.getByText("Organizer")).toBeInTheDocument();
    expect(screen.getByText("@organizer")).toBeInTheDocument();
  });

  it("handleInscribirse NO suma optimistamente a counts (regresión: contaba de a 2 por race con socket)", async () => {
    setupEvento(
      makeEvento({
        fee: 0,
        status: "open",
        registrationCount: { total: 2, pending: 1, confirmed: 1 },
      }),
    );
    server.use(
      http.post("/api/eventos/:id/inscribirse", () =>
        HttpResponse.json({ _id: "myReg", status: "pending" }, { status: 201 }),
      ),
    );
    localStorage.setItem("token", "fake");
    renderDetail({ user: { _id: "me" } });
    await screen.findByRole("heading", { name: "Mi Evento" });

    // Counts iniciales: active = pending(1) + confirmed(1) = 2.
    // El meta-strip muestra "2 de 20" en la celda Cupo.
    fireEvent.click(
      await screen.findByRole("button", { name: /^inscribirme/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^confirmar$/i }));

    // Esperar a que el POST resuelva (aparece estado "Pendiente de revisión").
    await screen.findByText(/pendiente de revisión/i);

    // El handler NO debe haber sumado optimistamente — los counts siguen igual
    // hasta que llegue el socket evento:counts-changed (que simulamos abajo).
    expect(screen.getByText(/2 de 20/)).toBeInTheDocument();

    // Simulamos el broadcast del server. El handler debe REEMPLAZAR (no sumar).
    triggerSocket("evento:counts-changed", {
      eventoId: "e1",
      counts: { total: 3, pending: 2, confirmed: 1 },
    });
    // Active count nuevo = 2+1 = 3.
    expect(await screen.findByText(/3 de 20/)).toBeInTheDocument();

    localStorage.removeItem("token");
  });

  it("socket evento:updated no pisa userRegistration con null (regresión: el broadcast hacía perder el badge de inscripción)", async () => {
    // User no-host con inscripción confirmada.
    setupEvento(
      makeEvento({
        title: "Original",
        userRegistration: { status: "confirmed", _id: "myReg" },
      }),
    );
    // Token presente para que el useEffect del socket avance.
    localStorage.setItem("token", "fake-token");
    renderDetail({ user: { _id: "me" } });
    // Badge inicial visible.
    expect(
      await screen.findByText(/inscripción confirmada/i),
    ).toBeInTheDocument();

    // Otro admin edita el evento → server emite con userRegistration:null.
    triggerSocket("evento:updated", {
      eventoId: "e1",
      evento: {
        _id: "e1",
        title: "Renombrado",
        status: "open",
        registrationCount: { total: 1, pending: 0, confirmed: 1 },
        userRegistration: null,
      },
    });

    // El título cambia pero el badge de inscripción confirmada sigue.
    expect(
      await screen.findByRole("heading", { name: /renombrado/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/inscripción confirmada/i)).toBeInTheDocument();

    localStorage.removeItem("token");
  });

  it("guarda edits sin pisar confirmedRegistrations (regresión: PUT no incluye ese campo)", async () => {
    // Host con dos confirmados visibles en su lista de inscriptos.
    setupEvento(
      makeEvento({
        title: "Original",
        author: { _id: "me", username: "me", displayName: "Me", avatar: null },
        confirmedRegistrations: [
          {
            _id: "rA",
            user: {
              _id: "uA",
              username: "alice",
              displayName: "Alice",
              avatar: null,
            },
          },
          {
            _id: "rB",
            user: {
              _id: "uB",
              username: "bob",
              displayName: "Bob",
              avatar: null,
            },
          },
        ],
      }),
    );
    // El PUT del server NO incluye confirmedRegistrations en su payload.
    server.use(
      http.put("/api/eventos/:id", () =>
        HttpResponse.json({
          _id: "e1",
          title: "Renombrado",
          status: "open",
          registrationCount: { total: 2, pending: 0, confirmed: 2 },
          userRegistration: null,
        }),
      ),
    );
    renderDetail({ user: { _id: "me" } });
    // Confirmados visibles antes del edit.
    await screen.findByText("Alice");
    expect(screen.getByText("Bob")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /editar/i }));
    fireEvent.change(await screen.findByLabelText(/título/i), {
      target: { value: "Renombrado" },
    });
    fireEvent.change(screen.getByLabelText(/fecha y hora/i), {
      target: { value: "2027-02-02T20:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));

    // Nuevo título aparece y la lista de inscriptos confirmados sigue visible.
    expect(
      await screen.findByRole("heading", { name: /renombrado/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("T4 — el socket conecta en paralelo con el fetch HTTP y los handlers toleran prev=null si llegan antes de que el fetch resuelva", async () => {
    // Diferimos el GET /api/eventos/:id para mantener al cliente en estado de
    // loading mientras emitimos un broadcast por el socket. Esto reproduce la
    // ventana entre fetch-start y respuesta del server donde antes (con el
    // useEffect que dependía de `evento?._id` para conectar el socket) el
    // cliente se perdía los broadcasts. Con useEventoSocket dependiendo solo
    // de `id`, el socket queda abierto desde el primer render.
    let resolveGet;
    const gating = new Promise((r) => {
      resolveGet = r;
    });

    const eventoHttp = makeEvento({
      registrationCount: { total: 2, pending: 1, confirmed: 1 },
    });
    server.use(
      http.get("/api/eventos/:id", async () => {
        await gating;
        return HttpResponse.json(eventoHttp);
      }),
    );

    // Reset socket capture antes de render — confiamos en que el mock recrea
    // el socket cada vez que se invoca `io(...)`.
    socketListeners.clear();
    _lastSocket = null;
    localStorage.setItem("token", "fake-token");

    try {
      renderDetail({ user: { _id: "me" } });

      // El socket se construye y registra sus listeners ANTES de que el
      // fetch HTTP resuelva (no espera evento._id, depende solo del id de la URL).
      await waitFor(() => expect(_lastSocket).not.toBeNull());
      expect(socketListeners.has("evento:counts-changed")).toBe(true);
      expect(socketListeners.has("evento:registration-reviewed")).toBe(true);
      expect(socketListeners.has("evento:updated")).toBe(true);

      // Mientras el fetch sigue pendiente, llega un broadcast. El handler
      // está envuelto en `setEvento((prev) => prev ? ... : prev)`, así que
      // tolera prev=null y no crashea.
      expect(() =>
        triggerSocket("evento:counts-changed", {
          eventoId: "e1",
          counts: { total: 9, pending: 9, confirmed: 9 },
        }),
      ).not.toThrow();
      expect(() =>
        triggerSocket("evento:registration-reviewed", {
          eventoId: "e1",
          userId: "someone",
          status: "confirmed",
          counts: { total: 9, pending: 9, confirmed: 9 },
        }),
      ).not.toThrow();
      expect(() =>
        triggerSocket("evento:updated", {
          eventoId: "e1",
          evento: { ...eventoHttp, title: "Renombrado prematuro" },
        }),
      ).not.toThrow();

      // Ahora dejamos pasar el fetch. El estado renderizado debe venir del
      // HTTP, no de los sockets que llegaron antes (esos se descartaron por
      // prev=null). "Cupo: 2 de 20" — active = pending + confirmed = 1+1 = 2.
      resolveGet();
      await screen.findByRole("heading", { name: "Mi Evento" });
      expect(screen.getByText(/2 de 20/)).toBeInTheDocument();

      // Y un broadcast posterior sí se aplica — confirma que los listeners
      // siguen vivos después del fetch (no se reconectó el socket).
      triggerSocket("evento:counts-changed", {
        eventoId: "e1",
        counts: { total: 5, pending: 4, confirmed: 1 },
      });
      expect(await screen.findByText(/5 de 20/)).toBeInTheDocument();
    } finally {
      localStorage.removeItem("token");
    }
  });
});

// ───────────────────────────────────────────────────────────────────────
// "Compartir tu experiencia" → crea una compartida vinculada al evento
// ───────────────────────────────────────────────────────────────────────
function CompartidasProbe() {
  const loc = useLocation();
  return (
    <div>
      probe{loc.pathname}
      {loc.search}
    </div>
  );
}

function renderWithProbe({ user = null, evento }) {
  setupEvento(evento);
  useAuth.mockReturnValue({ user });
  useNotifications.mockReturnValue({ setActiveEvento: vi.fn() });
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/eventos/e1"]}>
        <Routes>
          <Route path="/eventos/:id" element={<EventoDetail />} />
          <Route path="/compartidas" element={<CompartidasProbe />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe("<EventoDetail> — Compartir tu experiencia", () => {
  const SHARE = { name: /compartir tu experiencia/i };

  it("visible para el host → navega a /compartidas?evento=e1", async () => {
    renderWithProbe({
      user: { _id: "me" },
      evento: makeEvento({
        author: { _id: "me", username: "me", displayName: "Me", avatar: null },
      }),
    });
    fireEvent.click(await screen.findByRole("button", SHARE));
    expect(
      await screen.findByText(/\/compartidas\?evento=e1/),
    ).toBeInTheDocument();
  });

  it("visible para inscripción confirmada", async () => {
    renderWithProbe({
      user: { _id: "me" },
      evento: makeEvento({ userRegistration: { status: "confirmed" } }),
    });
    expect(await screen.findByRole("button", SHARE)).toBeInTheDocument();
  });

  it("visible para inscripción pendiente", async () => {
    renderWithProbe({
      user: { _id: "me" },
      evento: makeEvento({ userRegistration: { status: "pending" } }),
    });
    expect(await screen.findByRole("button", SHARE)).toBeInTheDocument();
  });

  it("NO visible para un usuario sin inscripción", async () => {
    renderWithProbe({
      user: { _id: "me" },
      evento: makeEvento({ userRegistration: null }),
    });
    await screen.findByRole("heading", { name: "Mi Evento" });
    expect(screen.queryByRole("button", SHARE)).not.toBeInTheDocument();
  });

  it("NO visible para invitado (sin login)", async () => {
    renderWithProbe({ user: null, evento: makeEvento() });
    await screen.findByRole("heading", { name: "Mi Evento" });
    expect(screen.queryByRole("button", SHARE)).not.toBeInTheDocument();
  });

  it("NO visible en eventos draft o cancelled aunque seas host", async () => {
    renderWithProbe({
      user: { _id: "me" },
      evento: makeEvento({
        status: "cancelled",
        author: { _id: "me", username: "me", displayName: "Me", avatar: null },
      }),
    });
    await screen.findByRole("heading", { name: "Mi Evento" });
    expect(screen.queryByRole("button", SHARE)).not.toBeInTheDocument();
  });
});
