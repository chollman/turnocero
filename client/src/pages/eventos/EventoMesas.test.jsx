import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));
// TableCard tiene muchas dependencias (Avatar, distance utils, etc.). Lo
// mockeamos como un placeholder simple — los tests acá no validan TableCard.
vi.mock("../../pages/dashboard/TableCard", () => ({
  default: ({ table }) => <div data-testid="table-card">{table.boardGame}</div>,
}));

import EventoMesas from "./EventoMesas";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";

let lastLocation = null;
function LocationProbe() {
  // Lee location del Router para verificar navigate.
  const { useLocation } = require("react-router-dom");
  lastLocation = useLocation();
  return null;
}

function renderIt({ canAdd = false } = {}) {
  return render(
    <MemoryRouter initialEntries={["/eventos/ev1"]}>
      <Routes>
        <Route
          path="/eventos/:id"
          element={<EventoMesas eventoId="ev1" canAdd={canAdd} />}
        />
        <Route path="/mesas/crear" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  lastLocation = null;
  useAuth.mockReturnValue({ user: { _id: "me", username: "me" } });
  useNotifications.mockReturnValue({ addToast: vi.fn() });
  server.use(
    http.get("/api/eventos/:id/mesas", () =>
      HttpResponse.json({ tables: [], total: 0, page: 1, pages: 1 }),
    ),
  );
});

describe("<EventoMesas>", () => {
  it("shows empty state when no mesas exist", async () => {
    renderIt();
    expect(
      await screen.findByText(/todav.a no hay mesas/i),
    ).toBeInTheDocument();
  });

  it("renders TableCard per mesa", async () => {
    server.use(
      http.get("/api/eventos/:id/mesas", () =>
        HttpResponse.json({
          tables: [
            { _id: "t1", boardGame: "Catan", host: { _id: "h1" } },
            { _id: "t2", boardGame: "Wingspan", host: { _id: "h1" } },
          ],
          total: 2,
          page: 1,
          pages: 1,
        }),
      ),
    );
    renderIt();
    expect(await screen.findByText("Catan")).toBeInTheDocument();
    expect(screen.getByText("Wingspan")).toBeInTheDocument();
    expect(screen.getAllByTestId("table-card")).toHaveLength(2);
  });

  it("hides the create button when canAdd=false", async () => {
    renderIt({ canAdd: false });
    await screen.findByText(/todav.a no hay mesas/i);
    expect(
      screen.queryByRole("button", { name: /crear mesa/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the create button when canAdd=true", async () => {
    renderIt({ canAdd: true });
    await screen.findByText(/todav.a no hay mesas/i);
    expect(
      screen.getByRole("button", { name: /crear mesa/i }),
    ).toBeInTheDocument();
  });

  it("clicking 'Crear mesa' navigates to /mesas/crear?evento=<id>", async () => {
    renderIt({ canAdd: true });
    await screen.findByText(/todav.a no hay mesas/i);
    fireEvent.click(screen.getByRole("button", { name: /crear mesa/i }));
    await waitFor(() => {
      expect(lastLocation?.pathname).toBe("/mesas/crear");
      expect(lastLocation?.search).toBe("?evento=ev1");
    });
  });
});
