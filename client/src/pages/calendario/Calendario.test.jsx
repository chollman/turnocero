import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import { monthLabel, addMonths } from "../../utils/calendar";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/SiteConfigContext", () => ({ useSiteConfig: vi.fn() }));
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));

import Calendario from "./Calendario";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useNotifications } from "../../context/NotificationContext";

function makeItem(over = {}) {
  return {
    id: over.id || "i1",
    tipo: over.tipo || "evento",
    title: over.title || "Actividad de prueba",
    subtitle: over.subtitle || "",
    date: over.date || new Date().toISOString(),
    status: over.status || "open",
    url: over.url || "/eventos/i1",
    host: null,
  };
}

function setup({ user = null, items = [], sections = {} } = {}) {
  useAuth.mockReturnValue({ user });
  useNotifications.mockReturnValue({ addToast: vi.fn() });
  useSiteConfig.mockReturnValue({
    isSectionEnabled: (key) => sections[key] !== false,
  });
  server.use(
    http.get("/api/calendario", () =>
      HttpResponse.json({ items, scope: "todas" }),
    ),
  );
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <Calendario />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe("<Calendario>", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renderiza el hero", async () => {
    setup();
    expect(
      await screen.findByRole("heading", { name: /qué se viene/i }),
    ).toBeInTheDocument();
  });

  it("muestra los tres chips de tipo cuando las secciones están habilitadas", async () => {
    setup();
    expect(screen.getByRole("button", { name: /Mesa/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Evento/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Torneo/ })).toBeInTheDocument();
  });

  it("oculta el chip de un tipo cuya sección está deshabilitada", async () => {
    setup({ sections: { torneos: false } });
    expect(
      screen.queryByRole("button", { name: /Torneo/ }),
    ).not.toBeInTheDocument();
  });

  it("muestra el toggle 'Mías' solo si hay usuario", async () => {
    setup({ user: { _id: "u1" } });
    expect(screen.getByRole("button", { name: "Mías" })).toBeInTheDocument();
  });

  it("no muestra el toggle 'Mías' para invitados", async () => {
    setup({ user: null });
    expect(
      screen.queryByRole("button", { name: "Mías" }),
    ).not.toBeInTheDocument();
  });

  it("carga los items y los muestra en la vista Agenda", async () => {
    setup({ items: [makeItem({ title: "Noche de Eurogames" })] });
    fireEvent.click(screen.getByRole("button", { name: "Agenda" }));
    expect(await screen.findByText("Noche de Eurogames")).toBeInTheDocument();
  });

  it("navega al mes siguiente al hacer click en la flecha", async () => {
    setup();
    const now = new Date();
    const current = monthLabel(now.getFullYear(), now.getMonth());
    expect(screen.getByText(current)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    const next = addMonths(now.getFullYear(), now.getMonth(), 1);
    await waitFor(() =>
      expect(
        screen.getByText(monthLabel(next.year, next.month)),
      ).toBeInTheDocument(),
    );
  });

  it("muestra estado vacío en Agenda cuando no hay items", async () => {
    setup({ items: [] });
    fireEvent.click(screen.getByRole("button", { name: "Agenda" }));
    expect(
      await screen.findByText(/No hay actividades próximas/i),
    ).toBeInTheDocument();
  });
});
