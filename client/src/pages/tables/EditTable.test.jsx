import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: () => ({ addToast: vi.fn() }),
}));

// Mocks de los componentes de mapa — sus tests propios cubren el comportamiento.
vi.mock("../../components/shared/AddressMap", () => ({
  default: ({ lat, lng }) => (
    <div data-testid="address-map" data-lat={lat ?? ""} data-lng={lng ?? ""} />
  ),
}));
vi.mock("../../components/shared/PlaceAutocomplete", () => ({
  default: ({ value, onChange, placeholder }) => (
    <input
      data-testid="place-autocomplete"
      value={value || ""}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import EditTable from "./EditTable";
import { useAuth } from "../../context/AuthContext";

function makeTable(overrides = {}) {
  return {
    _id: "t1",
    boardGame: "Catán",
    date: new Date(Date.now() + 7 * 86400000).toISOString(),
    maxPlayers: 4,
    players: [],
    location: "Buenos Aires",
    description: "Notas",
    host: { _id: "host1", username: "host1" },
    status: "open",
    privacy: "public",
    ...overrides,
  };
}

function renderEdit({ user = { _id: "host1" }, id = "t1" } = {}) {
  useAuth.mockReturnValue({ user });
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[`/mesas/${id}/editar`]}>
        <Routes>
          <Route path="/mesas/:id/editar" element={<EditTable />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  navigateMock.mockReset();
});

describe("<EditTable>", () => {
  it("non-host gets redirected to /mesas", async () => {
    server.use(
      http.get("/api/tables/:id", () => HttpResponse.json(makeTable())),
    );
    renderEdit({ user: { _id: "me" } });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/mesas");
    });
  });

  it("cancelled table redirects to /mesas", async () => {
    server.use(
      http.get("/api/tables/:id", () =>
        HttpResponse.json(makeTable({ status: "cancelled" })),
      ),
    );
    renderEdit();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/mesas");
    });
  });

  it("host sees the prefilled wizard with game read-only", async () => {
    server.use(
      http.get("/api/tables/:id", () => HttpResponse.json(makeTable())),
    );
    renderEdit();
    await waitFor(() => {
      expect(screen.getByText(/ajustá tu/i)).toBeInTheDocument();
    });
    // Game name is rendered as read-only (NO input), location + description
    // come prefilled.
    expect(screen.queryByPlaceholderText(/buscá un juego/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("Catán").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Buenos Aires")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Notas")).toBeInTheDocument();
  });

  it("PUT /api/tables/:id on submit, then navigate to detail", async () => {
    let putCalled = false;
    server.use(
      http.get("/api/tables/:id", () => HttpResponse.json(makeTable())),
      http.put("/api/tables/:id", () => {
        putCalled = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    renderEdit();
    await screen.findByText(/ajustá tu/i);

    fireEvent.change(screen.getByDisplayValue("Buenos Aires"), {
      target: { value: "Córdoba" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /guardar cambios/i }),
    );

    await waitFor(() => expect(putCalled).toBe(true));
    expect(navigateMock).toHaveBeenCalledWith("/mesas/t1");
  });

  it("'Cancelar mesa' (danger zone) calls DELETE after confirm + navigates to /mesas", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    let deleteCalled = false;
    server.use(
      http.get("/api/tables/:id", () => HttpResponse.json(makeTable())),
      http.delete("/api/tables/:id", () => {
        deleteCalled = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    renderEdit();
    await screen.findByText(/ajustá tu/i);

    fireEvent.click(screen.getByRole("button", { name: /cancelar mesa/i }));

    await waitFor(() => expect(deleteCalled).toBe(true));
    expect(navigateMock).toHaveBeenCalledWith("/mesas");
    confirmSpy.mockRestore();
  });
});
