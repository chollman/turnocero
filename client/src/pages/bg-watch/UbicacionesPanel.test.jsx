import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

import UbicacionesPanel from "./UbicacionesPanel";

function casa(extra = {}) {
  return {
    key: "k:l:casa",
    overlayId: null,
    rawKeys: ["l:casa"],
    name: "Casa",
    numPlays: 5,
    lastPlayedDate: "2026-03-01",
    ...extra,
  };
}

function listResponse(items) {
  return HttpResponse.json({
    items,
    total: items.length,
    page: 1,
    pages: 1,
  });
}

function renderPanel() {
  return render(
    <MemoryRouter>
      <UbicacionesPanel bggUsername="alice" />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  server.use(
    http.get("/api/bgg/ubicaciones/:user", () => listResponse([casa()])),
  );
});

describe("<UbicacionesPanel>", () => {
  it("renderiza la lista de ubicaciones", async () => {
    renderPanel();
    expect(await screen.findByText("Casa")).toBeInTheDocument();
    expect(screen.getByText(/5 partidas/)).toBeInTheDocument();
  });

  it("reporta el total al padre (para el badge de la tab)", async () => {
    server.use(
      http.get("/api/bgg/ubicaciones/:user", () =>
        HttpResponse.json({ items: [casa()], total: 9, page: 1, pages: 1 }),
      ),
    );
    const onTotalChange = vi.fn();
    render(
      <MemoryRouter>
        <UbicacionesPanel bggUsername="alice" onTotalChange={onTotalChange} />
      </MemoryRouter>,
    );
    await screen.findByText("Casa");
    await waitFor(() => expect(onTotalChange).toHaveBeenCalledWith(9));
  });

  it("clic en una fila navega al detalle de la ubicación", async () => {
    function LocationProbe() {
      const loc = useLocation();
      return <div data-testid="loc">{loc.pathname}</div>;
    }
    render(
      <MemoryRouter initialEntries={["/bg-watch/alice/ubicaciones"]}>
        <Routes>
          <Route
            path="/bg-watch/alice/ubicaciones"
            element={<UbicacionesPanel bggUsername="alice" />}
          />
          <Route
            path="/bg-watch/:u/ubicacion/:key"
            element={<LocationProbe />}
          />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Casa/ }));
    const loc = await screen.findByTestId("loc");
    expect(loc).toHaveTextContent("/bg-watch/alice/ubicacion/");
    expect(loc.textContent).toContain("casa");
  });

  it("muestra vacío cuando no hay ubicaciones", async () => {
    server.use(http.get("/api/bgg/ubicaciones/:user", () => listResponse([])));
    renderPanel();
    expect(await screen.findByText(/sin ubicaciones aún/i)).toBeInTheDocument();
  });
});
