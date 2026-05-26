import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

import TableCard from "./TableCard";
import { useAuth } from "../../context/AuthContext";

function makeTable(overrides = {}) {
  return {
    _id: overrides._id || "t1",
    boardGame: "Catán",
    date: new Date(Date.now() + 7 * 86400000).toISOString(),
    maxPlayers: 4,
    players: [],
    location: "Buenos Aires",
    host: {
      _id: "host1",
      username: "thehost",
      avatar: { url: "", publicId: "" },
    },
    status: "open",
    privacy: "public",
    pendingRequests: [],
    tags: [],
    ...overrides,
  };
}

function renderCard(table, { user = { _id: "me", username: "me" } } = {}) {
  useAuth.mockReturnValue({ user });
  return render(
    <MemoryRouter>
      <TableCard table={table} onUpdate={vi.fn()} onCancel={vi.fn()} />
    </MemoryRouter>,
  );
}

describe("<TableCard> grid mode", () => {
  it("renders the game name, location, and host", () => {
    renderCard(makeTable());
    expect(screen.getByText("Catán")).toBeInTheDocument();
    expect(screen.getByText("Buenos Aires")).toBeInTheDocument();
    expect(screen.getByText("thehost")).toBeInTheDocument();
  });

  it("shows Host badge when the current user is the host", () => {
    renderCard(
      makeTable({
        host: { _id: "me", username: "me", avatar: { url: "", publicId: "" } },
      }),
      { user: { _id: "me", username: "me" } },
    );
    expect(screen.getAllByText(/^Host$/).length).toBeGreaterThan(0);
  });

  it("shows Unido badge when the current user is in players", () => {
    renderCard(
      makeTable({
        players: [
          { _id: "me", username: "me", avatar: { url: "", publicId: "" } },
        ],
      }),
      { user: { _id: "me", username: "me" } },
    );
    expect(screen.getAllByText(/^Unido$/i).length).toBeGreaterThan(0);
  });

  it("renders seat count 1/5 with no players (just the host) on a 4-max table", () => {
    renderCard(makeTable({ maxPlayers: 4, players: [] }));
    expect(screen.getByText("1/5")).toBeInTheDocument();
  });

  it('renders "Usuario eliminado" when host is null (deleted)', () => {
    renderCard(makeTable({ host: null }));
    expect(screen.getByText("Usuario eliminado")).toBeInTheDocument();
  });

  it("renders tags when present", () => {
    renderCard(makeTable({ tags: ["Estrategia", "120-180min"] }));
    expect(screen.getByText("Estrategia")).toBeInTheDocument();
    expect(screen.getByText("120-180min")).toBeInTheDocument();
  });

  it("does not render tag row when tags array is empty", () => {
    const { container } = renderCard(makeTable({ tags: [] }));
    expect(container.querySelector('[class*="tagsRow"]')).toBeNull();
  });

  it("non-host non-player: clicking the join CTA hits the API and calls onUpdate", async () => {
    const onUpdate = vi.fn();
    const table = makeTable();
    useAuth.mockReturnValue({ user: { _id: "me", username: "me" } });
    server.use(
      http.post("/api/tables/:id/join", () =>
        HttpResponse.json({
          table: { ...table, players: [{ _id: "me", username: "me" }] },
        }),
      ),
    );
    render(
      <MemoryRouter>
        <TableCard table={table} onUpdate={onUpdate} onCancel={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Unirme$/i }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
  });

  it('shows "Mesa llena" disabled CTA when table is full', () => {
    renderCard(
      makeTable({ maxPlayers: 2, players: [{ _id: "p1" }, { _id: "p2" }] }),
    );
    const cta = screen.getByRole("button", { name: /mesa llena/i });
    expect(cta).toBeDisabled();
  });

  it("host actions show Editar / Cancelar icon buttons + Administrar CTA", () => {
    renderCard(
      makeTable({
        host: { _id: "me", username: "me", avatar: { url: "", publicId: "" } },
      }),
      { user: { _id: "me", username: "me" } },
    );
    expect(screen.getByTitle("Editar")).toBeInTheDocument();
    expect(screen.getByTitle("Cancelar mesa")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /administrar/i }),
    ).toBeInTheDocument();
  });

  it("player state shows Abandonar icon + Unido CTA", () => {
    renderCard(makeTable({ players: [{ _id: "me", username: "me" }] }), {
      user: { _id: "me", username: "me" },
    });
    expect(screen.getByTitle("Abandonar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unido/i })).toBeInTheDocument();
  });

  it('pending-request state shows "Solicitud enviada" CTA', () => {
    renderCard(makeTable({ pendingRequests: [{ _id: "me" }] }));
    expect(
      screen.getByRole("button", { name: /solicitud enviada/i }),
    ).toBeInTheDocument();
  });

  it("shows admin tab when user is admin and not host/player", () => {
    renderCard(makeTable(), {
      user: { _id: "me", isAdmin: true, username: "admin" },
    });
    expect(screen.getByTitle(/admin/i)).toBeInTheDocument();
  });

  it("anonymous user clicking Unirme opens LoginPromptModal", () => {
    useAuth.mockReturnValue({ user: null });
    render(
      <MemoryRouter>
        <TableCard table={makeTable()} onUpdate={vi.fn()} onCancel={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Unirme$/i }));
    expect(screen.getByText(/para unirte/i)).toBeInTheDocument();
  });

  it("handleLeave (player) hits the API and calls onUpdate", async () => {
    const onUpdate = vi.fn();
    const table = makeTable({ players: [{ _id: "me", username: "me" }] });
    useAuth.mockReturnValue({ user: { _id: "me", username: "me" } });
    server.use(
      http.post("/api/tables/:id/leave", () =>
        HttpResponse.json({ ...table, players: [] }),
      ),
    );
    render(
      <MemoryRouter>
        <TableCard table={table} onUpdate={onUpdate} onCancel={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTitle("Abandonar"));
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
  });

  it("handleCancelRequest hits DELETE /request and calls onUpdate", async () => {
    const onUpdate = vi.fn();
    const table = makeTable({ pendingRequests: [{ _id: "me" }] });
    useAuth.mockReturnValue({ user: { _id: "me", username: "me" } });
    server.use(
      http.delete("/api/tables/:id/request", () =>
        HttpResponse.json({ table: { ...table, pendingRequests: [] } }),
      ),
    );
    render(
      <MemoryRouter>
        <TableCard table={table} onUpdate={onUpdate} onCancel={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /solicitud enviada/i }),
    );
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
  });

  it("renders location.texto when location is a subdocument", () => {
    renderCard(
      makeTable({
        location: { texto: "Av. Corrientes 1234", lat: -34.6, lng: -58.4 },
      }),
    );
    expect(screen.getByText("Av. Corrientes 1234")).toBeInTheDocument();
  });

  it("shows the distance badge when distanceKm is present", () => {
    renderCard(
      makeTable({
        location: { texto: "CABA", lat: -34.6, lng: -58.4 },
        distanceKm: 12.34,
      }),
    );
    expect(screen.getByText(/12,3 km/)).toBeInTheDocument();
  });

  it("does NOT show the distance badge when distanceKm is null", () => {
    renderCard(
      makeTable({
        location: { texto: "CABA", lat: null, lng: null },
        distanceKm: null,
      }),
    );
    expect(screen.queryByText(/km/)).not.toBeInTheDocument();
  });

  it("does NOT show distance badge for distanceKm === 0", () => {
    renderCard(
      makeTable({
        location: { texto: "Casa", lat: -34.6, lng: -58.4 },
        distanceKm: 0,
      }),
    );
    expect(screen.queryByText(/aquí mismo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 m/)).not.toBeInTheDocument();
    expect(screen.getByText("Casa")).toBeInTheDocument();
  });

  it("handleCancel (host) confirms and DELETEs the table", async () => {
    const onCancel = vi.fn();
    const table = makeTable({
      host: { _id: "me", username: "me", avatar: { url: "", publicId: "" } },
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    useAuth.mockReturnValue({ user: { _id: "me", username: "me" } });
    server.use(
      http.delete("/api/tables/:id", () => HttpResponse.json({ ok: true })),
    );
    render(
      <MemoryRouter>
        <TableCard table={table} onUpdate={vi.fn()} onCancel={onCancel} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTitle("Cancelar mesa"));
    await waitFor(() => expect(onCancel).toHaveBeenCalledWith(table._id));
    confirmSpy.mockRestore();
  });
});

describe("<TableCard> list mode", () => {
  function renderList(table, opts = {}) {
    useAuth.mockReturnValue({
      user: opts.user || { _id: "me", username: "me" },
    });
    return render(
      <MemoryRouter>
        <TableCard
          table={table}
          onUpdate={vi.fn()}
          onCancel={vi.fn()}
          listMode
        />
      </MemoryRouter>,
    );
  }

  it("renders the game name + seat count in list mode", () => {
    renderList(makeTable({ maxPlayers: 4, players: [{ _id: "p1" }] }));
    expect(screen.getByText("Catán")).toBeInTheDocument();
    expect(screen.getByText("2/5")).toBeInTheDocument();
  });

  it("shows Host badge when user is host", () => {
    renderList(
      makeTable({
        host: { _id: "me", username: "me", avatar: { url: "", publicId: "" } },
      }),
    );
    expect(screen.getAllByText(/^Host$/).length).toBeGreaterThan(0);
  });

  it('shows "Solicitud enviada" CTA when user has pending request', () => {
    renderList(makeTable({ pendingRequests: [{ _id: "me" }] }));
    expect(
      screen.getByRole("button", { name: /solicitud enviada/i }),
    ).toBeInTheDocument();
  });

  it('shows "Solicitar →" CTA for private tables', () => {
    renderList(makeTable({ privacy: "private" }));
    expect(
      screen.getByRole("button", { name: /solicitar/i }),
    ).toBeInTheDocument();
  });

  it('shows "Mesa llena" disabled CTA when table is full', () => {
    renderList(makeTable({ maxPlayers: 1, players: [{ _id: "p1" }] }));
    const cta = screen.getByRole("button", { name: /mesa llena/i });
    expect(cta).toBeDisabled();
  });
});
