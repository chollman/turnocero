import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

import EventoInscripciones from "./EventoInscripciones";
import { useAuth } from "../../context/AuthContext";

function makeReg(id, status, overrides = {}) {
  return {
    _id: `r${id}`,
    user: {
      _id: id,
      username: `u${id}`,
      displayName: `User ${id}`,
      avatar: null,
    },
    status,
    submittedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    reviewedAt: status !== "pending" ? new Date().toISOString() : null,
    comprobante: { url: `https://example.com/${id}.pdf`, resourceType: "raw" },
    ...overrides,
  };
}

function setupResponse(payload) {
  server.use(
    http.get("/api/eventos/:id/inscripciones", () =>
      HttpResponse.json(payload),
    ),
  );
}

function renderInsc({ user = { _id: "admin", isAdmin: true } } = {}) {
  useAuth.mockReturnValue({ user, loading: false });
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/eventos/e1/inscripciones"]}>
        <Routes>
          <Route
            path="/eventos/:id/inscripciones"
            element={<EventoInscripciones />}
          />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

beforeEach(() => {
  setupResponse({
    registrations: [
      makeReg("a", "pending"),
      makeReg("b", "pending"),
      makeReg("c", "confirmed"),
      makeReg("d", "rejected", { adminNotes: "Comprobante ilegible" }),
    ],
    counts: { total: 4, pending: 2, confirmed: 1, rejected: 1 },
    evento: {
      _id: "e1",
      title: "Torneo Catán",
      eventDate: "2026-06-13T17:00:00",
      maxParticipants: 24,
    },
  });
});

describe("<EventoInscripciones>", () => {
  it("redirects non-admin users away", async () => {
    renderInsc({ user: { _id: "me", isAdmin: false } });
    expect(await screen.findByText("home")).toBeInTheDocument();
  });

  it("no dispara fetch a /inscripciones para no-admins (regresión: 403 inútil)", async () => {
    let fetchedCount = 0;
    server.use(
      http.get("/api/eventos/:id/inscripciones", () => {
        fetchedCount += 1;
        return HttpResponse.json({}, { status: 403 });
      }),
    );
    renderInsc({ user: { _id: "me", isAdmin: false } });
    await screen.findByText("home");
    expect(fetchedCount).toBe(0);
  });

  it("renders the event title as H1 (host identification) + 3 columns with counts", async () => {
    renderInsc();
    // H1 ahora es el título del evento, no la palabra "Inscripciones"
    expect(
      await screen.findByRole("heading", { name: /torneo catán/i, level: 1 }),
    ).toBeInTheDocument();
    // Y un eyebrow indicando contexto
    expect(screen.getByText(/gestión de inscripciones/i)).toBeInTheDocument();
    expect(screen.getByText(/pendientes de revisión/i)).toBeInTheDocument();
    expect(screen.getAllByText(/confirmadas/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/rechazadas/i).length).toBeGreaterThan(0);
  });

  it("renders all registrations across columns", async () => {
    renderInsc();
    await screen.findByText("User a");
    expect(screen.getByText("User a")).toBeInTheDocument();
    expect(screen.getByText("User b")).toBeInTheDocument();
    expect(screen.getByText("User c")).toBeInTheDocument();
    expect(screen.getByText("User d")).toBeInTheDocument();
  });

  it("accepting calls the confirmar endpoint with the right user id", async () => {
    let confirmedUserId = null;
    server.use(
      http.patch(
        "/api/eventos/:id/inscripciones/:userId/confirmar",
        ({ params }) => {
          confirmedUserId = params.userId;
          return HttpResponse.json({ ok: true });
        },
      ),
    );
    renderInsc();
    await screen.findByText("User a");
    const accepts = screen.getAllByRole("button", { name: /^confirmar$/i });
    fireEvent.click(accepts[0]);
    await waitFor(() => expect(confirmedUserId).toBe("a"));
  });

  it("rejecting calls the rechazar endpoint with the right user id", async () => {
    let rejectedUserId = null;
    server.use(
      http.patch(
        "/api/eventos/:id/inscripciones/:userId/rechazar",
        ({ params }) => {
          rejectedUserId = params.userId;
          return HttpResponse.json({ ok: true });
        },
      ),
    );
    renderInsc();
    await screen.findByText("User a");
    const rejects = screen.getAllByRole("button", { name: /^rechazar$/i });
    fireEvent.click(rejects[0]);
    await waitFor(() => expect(rejectedUserId).toBe("a"));
  });

  it("shows the undo button on rejected items", async () => {
    renderInsc();
    await screen.findByText("User d");
    expect(
      screen.getAllByRole("button", { name: /revertir/i }).length,
    ).toBeGreaterThan(0);
  });

  it('clicking "Revertir decisión" calls PATCH .../revertir and moves the reg back to pending', async () => {
    let revertedUserId = null;
    server.use(
      http.patch(
        "/api/eventos/:id/inscripciones/:userId/revertir",
        ({ params }) => {
          revertedUserId = params.userId;
          return HttpResponse.json({
            status: "pending",
            submittedAt: new Date().toISOString(),
          });
        },
      ),
    );
    renderInsc();
    await screen.findByText("User d");
    const undoBtns = screen.getAllByRole("button", { name: /revertir/i });
    fireEvent.click(undoBtns[0]); // first one is for confirmed 'User c' (alphabetical first)
    await waitFor(() => expect(revertedUserId).not.toBeNull());
  });

  it("renders 404 state when API returns 404", async () => {
    server.use(
      http.get("/api/eventos/:id/inscripciones", () =>
        HttpResponse.json({ message: "nf" }, { status: 404 }),
      ),
    );
    renderInsc();
    expect(
      await screen.findByText(/evento no encontrado/i),
    ).toBeInTheDocument();
  });
});
