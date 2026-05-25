import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";

vi.mock("../../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import RegisterButton from "./RegisterButton";
import { useNotifications } from "../../../context/NotificationContext";

function setupNotifs() {
  useNotifications.mockReturnValue({ addToast: vi.fn() });
}

function makeTorneo(overrides = {}) {
  return {
    _id: "t1",
    title: "Liga 2026",
    status: "registration",
    inscriptionMode: "open",
    participants: [],
    pendingRegistrations: [],
    maxParticipants: null,
    ...overrides,
  };
}

function renderBtn({
  torneo = makeTorneo(),
  user = null,
  onChange = vi.fn(),
} = {}) {
  setupNotifs();
  return render(
    <MemoryRouter>
      <RegisterButton torneo={torneo} user={user} onChange={onChange} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateMock.mockReset();
});

describe("<RegisterButton>", () => {
  it("renders nothing when torneo is not in registration", () => {
    const { container } = renderBtn({
      torneo: makeTorneo({ status: "in_progress" }),
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for admin_only inscriptionMode", () => {
    const { container } = renderBtn({
      torneo: makeTorneo({ inscriptionMode: "admin_only" }),
      user: { _id: "me" },
    });
    expect(container.firstChild).toBeNull();
  });

  it("shows the login CTA for anonymous users", () => {
    renderBtn({ user: null });
    expect(
      screen.getByRole("button", { name: /inici[aá] sesi[oó]n/i }),
    ).toBeInTheDocument();
  });

  it('shows "Inscribirme" when user is not yet registered', () => {
    renderBtn({ user: { _id: "me" } });
    expect(
      screen.getByRole("button", { name: /inscribirme/i }),
    ).toBeInTheDocument();
  });

  it('shows "Cupo lleno" disabled state when maxParticipants is reached', () => {
    renderBtn({
      torneo: makeTorneo({
        participants: [{ _id: "p1" }, { _id: "p2" }],
        maxParticipants: 2,
      }),
      user: { _id: "me" },
    });
    const btn = screen.getByRole("button", { name: /cupo lleno/i });
    expect(btn).toBeDisabled();
  });

  it('shows "Estás inscripto ✓" when user is a participant', () => {
    renderBtn({
      torneo: makeTorneo({ participants: [{ _id: "me" }] }),
      user: { _id: "me" },
    });
    expect(screen.getByText(/estás inscripto/i)).toBeInTheDocument();
  });

  it("shows pending state + Cancelar button when user has a pending registration", () => {
    renderBtn({
      torneo: makeTorneo({ pendingRegistrations: [{ user: { _id: "me" } }] }),
      user: { _id: "me" },
    });
    expect(screen.getByText(/inscripción pendiente/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancelar/i }),
    ).toBeInTheDocument();
  });

  it("clicking Inscribirme posts to /register and calls onChange", async () => {
    const onChange = vi.fn();
    server.use(
      http.post("/api/torneos/:id/register", () =>
        HttpResponse.json({ ok: true }),
      ),
    );
    renderBtn({ user: { _id: "me" }, onChange });
    fireEvent.click(screen.getByRole("button", { name: /inscribirme/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it("clicking Cancelar deletes /register and calls onChange", async () => {
    const onChange = vi.fn();
    server.use(
      http.delete("/api/torneos/:id/register", () =>
        HttpResponse.json({ ok: true }),
      ),
    );
    renderBtn({
      torneo: makeTorneo({ pendingRegistrations: [{ user: { _id: "me" } }] }),
      user: { _id: "me" },
      onChange,
    });
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it("shows API error on register failure", async () => {
    server.use(
      http.post("/api/torneos/:id/register", () =>
        HttpResponse.json({ message: "Cupo ya lleno" }, { status: 400 }),
      ),
    );
    renderBtn({ user: { _id: "me" } });
    fireEvent.click(screen.getByRole("button", { name: /inscribirme/i }));
    expect(await screen.findByText("Cupo ya lleno")).toBeInTheDocument();
  });
});
