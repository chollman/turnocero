import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));

import MathTradeDetail from "./MathTradeDetail";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";

beforeEach(() => {
  useNotifications.mockReturnValue({ addToast: vi.fn() });
});

function mockTrade(overrides = {}) {
  server.use(
    http.get("/api/mathtrade/m1", () =>
      HttpResponse.json({
        _id: "m1",
        title: "Mi Trade",
        description: "Reglas del trade",
        status: "open",
        matching: { mode: "max", maxChainLength: 4 },
        ...overrides,
      }),
    ),
    http.get("/api/mathtrade/m1/items", () =>
      HttpResponse.json([
        {
          _id: "i1",
          owner: { _id: "u2", username: "beto" },
          bggGameId: 1,
          gameName: "Catan",
          wants: [{ bggGameId: 2, gameName: "Azul" }],
        },
      ]),
    ),
    http.get("/api/mathtrade/m1/my-items", () => HttpResponse.json([])),
  );
}

const renderDetail = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/math-trade/m1"]}>
        <Routes>
          <Route path="/math-trade/:id" element={<MathTradeDetail />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

describe("MathTradeDetail", () => {
  it("muestra el título, estado y participantes", async () => {
    useAuth.mockReturnValue({
      user: null,
      isActuallyAdmin: false,
      viewAsUser: false,
    });
    mockTrade();
    renderDetail();
    await waitFor(() =>
      expect(screen.getByText("Mi Trade")).toBeInTheDocument(),
    );
    expect(screen.getByText("Inscripción abierta")).toBeInTheDocument();
    expect(screen.getByText(/Participantes \(1\)/)).toBeInTheDocument();
  });

  it("invita a iniciar sesión en la pestaña de ofertas sin usuario", async () => {
    useAuth.mockReturnValue({
      user: null,
      isActuallyAdmin: false,
      viewAsUser: false,
    });
    mockTrade();
    renderDetail();
    await waitFor(() =>
      expect(screen.getByText("Mi Trade")).toBeInTheDocument(),
    );
    expect(screen.getByText(/Iniciá sesión/)).toBeInTheDocument();
  });

  it("muestra el panel de admin para admins", async () => {
    useAuth.mockReturnValue({
      user: { _id: "admin1" },
      isActuallyAdmin: true,
      viewAsUser: false,
    });
    mockTrade();
    renderDetail();
    await waitFor(() =>
      expect(screen.getByText("Panel del organizador")).toBeInTheDocument(),
    );
  });
});
