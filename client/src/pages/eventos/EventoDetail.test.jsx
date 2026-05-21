import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

import EventoDetail from "./EventoDetail";
import { useAuth } from "../../context/AuthContext";

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

function renderDetail({ user = null, eventoId = "e1" } = {}) {
  useAuth.mockReturnValue({ user });
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
});
