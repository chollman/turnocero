import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

const addToast = vi.fn();
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: () => ({ addToast }),
}));

import BggUsagePanel from "./BggUsagePanel";

const summary = {
  from: "2026-06-16",
  to: "2026-06-17",
  totals: { reads: 42, syncs: 3, created: 5, edited: 2, deleted: 1 },
  perUser: [
    {
      userId: "u1",
      user: {
        _id: "u1",
        username: "alice",
        displayName: "Alice",
        avatar: { url: null },
      },
      bggUsername: "alice",
      reads: 30,
      syncs: 2,
      mutations: { created: 4, edited: 1, deleted: 0 },
      byEndpoint: { search: 10, thing: 15, plays: 5, collection: 0, other: 0 },
    },
    {
      userId: null,
      user: null,
      bggUsername: null,
      reads: 12,
      syncs: 1,
      mutations: { created: 1, edited: 1, deleted: 1 },
      byEndpoint: { search: 6, thing: 6, plays: 0, collection: 0, other: 0 },
    },
  ],
  byDay: [
    { day: "2026-06-16", reads: 12, syncs: 1, mutations: 3 },
    { day: "2026-06-17", reads: 30, syncs: 2, mutations: 5 },
  ],
};

const eventsPage = {
  from: "2026-06-16",
  to: "2026-06-17",
  page: 1,
  pages: 1,
  total: 2,
  events: [
    {
      _id: "e1",
      action: "create",
      playId: "1",
      gameId: "13",
      gameName: "Catan",
      bggUsername: "alice",
      user: { _id: "u1", username: "alice", displayName: "Alice", avatar: {} },
      createdAt: "2026-06-17T12:00:00Z",
    },
    {
      _id: "e2",
      action: "delete",
      playId: "2",
      gameId: "9",
      gameName: "Wingspan",
      bggUsername: "alice",
      user: { _id: "u1", username: "alice", displayName: "Alice", avatar: {} },
      createdAt: "2026-06-16T10:00:00Z",
    },
  ],
};

beforeEach(() => {
  addToast.mockClear();
  server.use(
    http.get("/api/admin/bgg-usage", () => HttpResponse.json(summary)),
    http.get("/api/admin/bgg-usage/events", () => HttpResponse.json(eventsPage)),
  );
});

const renderPanel = () =>
  render(
    <MemoryRouter>
      <BggUsagePanel />
    </MemoryRouter>,
  );

describe("<BggUsagePanel>", () => {
  it("muestra los totales del resumen", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("42")).toBeInTheDocument());
    expect(screen.getByText("Requests a BGG")).toBeInTheDocument();
    expect(screen.getByText("Partidas cargadas")).toBeInTheDocument();
  });

  it("renderiza una fila por usuario + el bucket anónimo", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("Anónimos")).toBeInTheDocument();
  });

  it("muestra el gráfico de tendencia por día", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("42")).toBeInTheDocument());
    expect(screen.getByText("Requests por día")).toBeInTheDocument();
    expect(screen.getByText("Partidas por día")).toBeInTheDocument();
  });

  it("exporta el resumen a CSV", async () => {
    const createSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:fake");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderPanel();
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    expect(createSpy).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it("ofrece filtrar la actividad por usuario", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "Actividad" }));
    await waitFor(() => expect(screen.getByText("Catan")).toBeInTheDocument());
    const select = screen.getByRole("combobox");
    // El bucket anónimo no es filtrable (no tiene mutaciones); solo Alice.
    expect(select).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Alice/ }),
    ).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "u1" } });
    expect(select.value).toBe("u1");
  });

  it("cambia a la pestaña Actividad y lista los eventos itemizados", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "Actividad" }));
    await waitFor(() => expect(screen.getByText("Catan")).toBeInTheDocument());
    expect(screen.getByText("Wingspan")).toBeInTheDocument();
    expect(screen.getByText("Cargó")).toBeInTheDocument();
    expect(screen.getByText("Borró")).toBeInTheDocument();
  });

  it("muestra empty state cuando no hubo actividad", async () => {
    server.use(
      http.get("/api/admin/bgg-usage", () =>
        HttpResponse.json({
          ...summary,
          perUser: [],
          totals: { reads: 0, syncs: 0, created: 0, edited: 0, deleted: 0 },
        }),
      ),
    );
    renderPanel();
    await waitFor(() =>
      expect(
        screen.getByText("No hubo actividad de BGG en este rango."),
      ).toBeInTheDocument(),
    );
  });

  it("toastea ante error de red", async () => {
    server.use(
      http.get(
        "/api/admin/bgg-usage",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    renderPanel();
    await waitFor(() => expect(addToast).toHaveBeenCalled());
  });
});
