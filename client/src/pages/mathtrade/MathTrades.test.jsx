import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import i18n from "../../i18n";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

import MathTrades from "./MathTrades";
import { useAuth } from "../../context/AuthContext";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

beforeEach(() => {
  useAuth.mockReturnValue({ isActuallyAdmin: false, viewAsUser: false });
});

afterEach(() => {
  i18n.changeLanguage("es");
});

const renderList = () =>
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <HelmetProvider>
        <MemoryRouter>
          <MathTrades />
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );

describe("MathTrades", () => {
  it("renderiza las cards que vuelven del server", async () => {
    server.use(
      http.get("/api/mathtrade", () =>
        HttpResponse.json({
          mathtrades: [
            {
              _id: "m1",
              title: "Trade de verano",
              status: "open",
              itemCount: 5,
              matching: { mode: "max" },
            },
          ],
          total: 1,
          page: 1,
          pages: 1,
        }),
      ),
    );
    renderList();
    await waitFor(() =>
      expect(screen.getByText("Trade de verano")).toBeInTheDocument(),
    );
    expect(screen.getByText(/5 juegos ofrecidos/)).toBeInTheDocument();
  });

  it("muestra el empty state sin intercambios", async () => {
    server.use(
      http.get("/api/mathtrade", () =>
        HttpResponse.json({ mathtrades: [], total: 0, page: 1, pages: 1 }),
      ),
    );
    renderList();
    await waitFor(() =>
      expect(
        screen.getByText(/No hay intercambios en esta vista/),
      ).toBeInTheDocument(),
    );
  });

  it("oculta el botón de crear a usuarios no-admin", async () => {
    server.use(
      http.get("/api/mathtrade", () =>
        HttpResponse.json({ mathtrades: [], total: 0, page: 1, pages: 1 }),
      ),
    );
    renderList();
    await waitFor(() =>
      expect(
        screen.getByText(/No hay intercambios en esta vista/),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("+ Nuevo intercambio")).not.toBeInTheDocument();
  });

  it("renderiza en inglés cuando el idioma es 'en'", async () => {
    i18n.changeLanguage("en");
    server.use(
      http.get("/api/mathtrade", () =>
        HttpResponse.json({
          mathtrades: [
            {
              _id: "m1",
              title: "Summer trade",
              status: "open",
              itemCount: 3,
              matching: { mode: "max" },
            },
          ],
          total: 1,
          page: 1,
          pages: 1,
        }),
      ),
    );
    renderList();
    await waitFor(() =>
      expect(screen.getByText("Summer trade")).toBeInTheDocument(),
    );
    expect(screen.getByText(/3 games offered/)).toBeInTheDocument();
    expect(screen.getByText("Registration open")).toBeInTheDocument();
    expect(screen.getByText(/Maximum chain/)).toBeInTheDocument();
  });
});
