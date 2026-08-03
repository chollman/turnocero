import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
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
function Providers({ children }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>
  );
}

let mockUser;
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));
vi.mock("../../components/shared/Avatar", () => ({
  // Render only the username so it doesn't clash with the name text in queries.
  default: ({ user }) => <div data-testid="avatar">{user?.username || ""}</div>,
}));

import JugadoresPanel from "./JugadoresPanel";

function juan(extra = {}) {
  return {
    key: "k:n:juan",
    overlayId: null,
    rawKeys: ["n:juan"],
    name: "Juan",
    username: "",
    numPlays: 3,
    lastPlayedDate: "2026-01-01",
    avatar: null,
    linkedUser: null,
    isLinked: false,
    canEditNameAvatar: true,
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
    <Providers><MemoryRouter>
      <JugadoresPanel bggUsername="alice" />
    </MemoryRouter></Providers>,
  );
}

beforeEach(() => {
  mockUser = { _id: "me", username: "alice", bggUsername: "alice" };
  server.use(
    http.get("/api/bgg/jugadores/:user", () => listResponse([juan()])),
  );
});

describe("<JugadoresPanel>", () => {
  it("renderiza la lista de jugadores", async () => {
    renderPanel();
    expect(await screen.findByText("Juan")).toBeInTheDocument();
    expect(screen.getByText(/3 partidas/)).toBeInTheDocument();
  });

  it("reporta el total de jugadores al padre (para el badge de la tab)", async () => {
    server.use(
      http.get("/api/bgg/jugadores/:user", () =>
        HttpResponse.json({ items: [juan()], total: 7, page: 1, pages: 1 }),
      ),
    );
    const onTotalChange = vi.fn();
    render(
      <Providers><MemoryRouter>
        <JugadoresPanel bggUsername="alice" onTotalChange={onTotalChange} />
      </MemoryRouter></Providers>,
    );
    await screen.findByText("Juan");
    await waitFor(() => expect(onTotalChange).toHaveBeenCalledWith(7));
  });

  it("la lista ya no muestra botones de editar/fusionar (la curación vive en el detalle)", async () => {
    renderPanel();
    await screen.findByText("Juan");
    expect(screen.queryByRole("button", { name: /^editar$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /fusionar/i })).toBeNull();
  });

  it("una fila marcada como vos muestra el badge y permite deshacer", async () => {
    let body = null;
    server.use(
      http.get("/api/bgg/jugadores/:user", () =>
        listResponse([juan({ isSelf: true })]),
      ),
      http.post("/api/bgg/jugadores/:user/yo-mismo", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ player: juan({ isSelf: false }) });
      }),
    );
    renderPanel();
    await screen.findByText("Juan");
    expect(screen.getByText(/sos vos/i)).toBeInTheDocument();
    // No se ofrece editar/fusionar para "vos".
    expect(screen.queryByRole("button", { name: /^editar$/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /ya no soy yo/i }));
    await waitFor(() => expect(body).toBeTruthy());
    expect(body).toEqual({ rawKeys: ["n:juan"], value: false });
  });

  it("clic en una fila navega al detalle del jugador", async () => {
    function LocationProbe() {
      const loc = useLocation();
      return <div data-testid="loc">{loc.pathname}</div>;
    }
    render(
      <Providers><MemoryRouter initialEntries={["/bg-watch/alice/jugadores"]}>
        <Routes>
          <Route
            path="/bg-watch/alice/jugadores"
            element={<JugadoresPanel bggUsername="alice" />}
          />
          <Route path="/bg-watch/:u/jugador/:key" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter></Providers>,
    );
    const rowBtn = await screen.findByRole("button", { name: /Juan/ });
    fireEvent.click(rowBtn);
    const loc = await screen.findByTestId("loc");
    expect(loc).toHaveTextContent("/bg-watch/alice/jugador/");
    expect(loc.textContent).toContain("juan");
  });

  it("muestra vacío cuando no hay jugadores", async () => {
    server.use(http.get("/api/bgg/jugadores/:user", () => listResponse([])));
    renderPanel();
    expect(await screen.findByText(/sin jugadores aún/i)).toBeInTheDocument();
  });
});
