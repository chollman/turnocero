import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

vi.mock("../../components/shared/Avatar", () => ({
  default: ({ user }) => (
    <div data-testid="avatar">{user?.displayName || user?.username || ""}</div>
  ),
}));
vi.mock("./PlayCard", () => ({
  default: ({ play, onClick }) => (
    <button data-testid="playcard" onClick={onClick}>
      {play.gameName} ({play.id})
    </button>
  ),
}));

import GroupStatsPanel from "./GroupStatsPanel";

const GRUPO = {
  roster: [
    { key: "k:u:cami", name: "Cami", username: "cami", wins: 3 },
    { key: "k:u:claudio", name: "Claudio", username: "claudio", wins: 1 },
  ],
  stats: {
    total: 4,
    firstPlayedDate: "2026-01-10",
    lastPlayedDate: "2026-06-01",
    byGame: [
      { gameId: "9100", name: "Brass: Birmingham", thumbnail: null, total: 3 },
      { gameId: "9200", name: "Wingspan", thumbnail: "t", total: 1 },
    ],
  },
  plays: [
    { id: "777", gameName: "Brass: Birmingham", players: [] },
    { id: "555", gameName: "Wingspan", players: [] },
  ],
  page: 1,
  total: 4,
  pageSize: 10,
};

let grupoCalls;

function stubGrupo(body = GRUPO) {
  grupoCalls = 0;
  server.use(
    http.get("/api/bgg/partida/:user/:playId/grupo", () => {
      grupoCalls += 1;
      return HttpResponse.json(body);
    }),
  );
}

function renderPanel() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={["/bg-watch/claudio/partidas/777"]}>
        <Routes>
          <Route
            path="/bg-watch/:bggUsername/partidas/:playId"
            element={
              <GroupStatsPanel bggUsername="claudio" playId="777" userMap={{}} />
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  stubGrupo();
});

describe("<GroupStatsPanel>", () => {
  it("arranca cerrado y NO fetchea hasta desplegarse", () => {
    renderPanel();
    expect(
      screen.getByRole("button", { name: /estadísticas con este grupo/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/partidas juntos/)).toBeNull();
    expect(grupoCalls).toBe(0);
  });

  it("al desplegar muestra total, victorias por integrante y juegos del grupo", async () => {
    renderPanel();
    fireEvent.click(
      screen.getByRole("button", { name: /estadísticas con este grupo/i }),
    );
    expect(await screen.findByText("partidas juntos")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("3 victorias")).toBeInTheDocument();
    expect(screen.getByText("1 victoria")).toBeInTheDocument();
    // "Cami" aparece en el avatar (stub) y en la fila del ranking.
    expect(screen.getAllByText("Cami").length).toBeGreaterThan(0);
    expect(screen.getByText("Wingspan")).toBeInTheDocument();
    expect(screen.getByText(/Primera: /)).toBeInTheDocument();
    expect(grupoCalls).toBe(1);
  });

  it("lista las otras partidas excluyendo la actual", async () => {
    renderPanel();
    fireEvent.click(
      screen.getByRole("button", { name: /estadísticas con este grupo/i }),
    );
    await screen.findByText("partidas juntos");
    const cards = screen.getAllByTestId("playcard");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent("Wingspan (555)");
  });

  it("muestra el vacío cuando el grupo no tiene otras partidas", async () => {
    stubGrupo({
      ...GRUPO,
      stats: { ...GRUPO.stats, total: 1 },
      plays: [{ id: "777", gameName: "Brass: Birmingham", players: [] }],
      total: 1,
    });
    renderPanel();
    fireEvent.click(
      screen.getByRole("button", { name: /estadísticas con este grupo/i }),
    );
    expect(
      await screen.findByText(/no tiene otras partidas registradas/),
    ).toBeInTheDocument();
  });

  it("muestra error si el fetch falla", async () => {
    server.use(
      http.get("/api/bgg/partida/:user/:playId/grupo", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderPanel();
    fireEvent.click(
      screen.getByRole("button", { name: /estadísticas con este grupo/i }),
    );
    expect(
      await screen.findByText(/No se pudieron cargar las estadísticas/),
    ).toBeInTheDocument();
  });
});
