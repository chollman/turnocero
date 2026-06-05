import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import { CommunityContext } from "../../context/CommunityContext";
import BgWatchComunidad from "./BgWatchComunidad";

const user = {
  _id: "u1",
  username: "alice",
  displayName: "Alicia",
  avatar: { url: "", publicId: "", color: "--green" },
};

beforeEach(() => {
  server.use(
    http.get("/api/bgg/comunidad/juegos", ({ request }) => {
      const url = new URL(request.url);
      const periodo = url.searchParams.get("periodo") || "all";
      const games =
        periodo === "mes"
          ? [
              {
                id: "200",
                name: "Juego Caliente",
                totalPlays: 3,
                playerCount: 2,
              },
            ]
          : [
              { id: "100", name: "Catan", totalPlays: 10, playerCount: 4 },
              { id: "200", name: "Wingspan", totalPlays: 5, playerCount: 3 },
            ];
      return HttpResponse.json({ periodo, games });
    }),
    http.get("/api/bgg/comunidad/jugadores", ({ request }) => {
      const metric = new URL(request.url).searchParams.get("metric") || "plays";
      return HttpResponse.json({
        metric,
        periodo: "all",
        players: [
          { bggUsername: "alice", totalPlays: 12, uniqueGames: 5, user },
        ],
      });
    }),
    http.get("/api/bgg/comunidad/actividad", () =>
      HttpResponse.json({
        items: [
          {
            id: "p1",
            bggUsername: "alice",
            logger: user,
            date: "2026-06-03",
            gameId: "100",
            gameName: "Catan",
            gameThumbnail: "",
            players: [],
          },
        ],
        total: 1,
        page: 1,
        pages: 1,
      }),
    ),
    http.get("/api/bgg/comunidad/heatmap", () =>
      HttpResponse.json({ heatmap: [{ date: "2026-06-03", count: 2 }] }),
    ),
  );
});

function renderHub() {
  return render(
    <MemoryRouter>
      <BgWatchComunidad />
    </MemoryRouter>,
  );
}

const baseCommunity = { _id: "base", name: "TurnoCero", isBase: true };
const betaCommunity = { _id: "beta", name: "Beta", isBase: false };

// Valor del CommunityContext para los tests del cartelito de scope. Por defecto:
// dos comunidades (base + Beta), viendo ambas → scope global.
function communityValue(overrides = {}) {
  return {
    loaded: true,
    isTenant: false,
    memberships: [{ community: baseCommunity }, { community: betaCommunity }],
    communityById: new Map([
      ["base", baseCommunity],
      ["beta", betaCommunity],
    ]),
    effectiveViewing: ["base", "beta"],
    ...overrides,
  };
}

function renderHubWithCommunity(value) {
  return render(
    <CommunityContext.Provider value={value}>
      <MemoryRouter>
        <BgWatchComunidad />
      </MemoryRouter>
    </CommunityContext.Provider>,
  );
}

describe("<BgWatchComunidad>", () => {
  it("muestra el ranking de juegos en la tab Juegos por defecto", async () => {
    renderHub();
    expect(await screen.findByText("Catan")).toBeInTheDocument();
    expect(screen.getByText("Wingspan")).toBeInTheDocument();
  });

  it("el toggle 'En llamas' refetchea con periodo=mes", async () => {
    renderHub();
    await screen.findByText("Catan");
    fireEvent.click(screen.getByRole("radio", { name: /en llamas/i }));
    expect(await screen.findByText("Juego Caliente")).toBeInTheDocument();
    expect(screen.queryByText("Catan")).not.toBeInTheDocument();
  });

  it("la tab Jugadores muestra el leaderboard con el usuario resuelto", async () => {
    renderHub();
    await screen.findByText("Catan");
    fireEvent.click(screen.getByRole("button", { name: "Jugadores" }));
    expect(await screen.findByText("Alicia")).toBeInTheDocument();
    expect(screen.getByText("12 partidas")).toBeInTheDocument();
  });

  it("la tab Actividad muestra el feed", async () => {
    renderHub();
    await screen.findByText("Catan");
    fireEvent.click(screen.getByRole("button", { name: "Actividad" }));
    await waitFor(() => expect(screen.getByText(/jugó/i)).toBeInTheDocument());
    expect(screen.getByText("Catan")).toBeInTheDocument();
  });
});

describe("<BgWatchComunidad> — cartelito de scope", () => {
  it("no se muestra sin CommunityProvider (lectura null-safe)", async () => {
    const { container } = renderHub();
    await screen.findByText("Catan");
    expect(container.textContent).not.toMatch(/Estás viendo/i);
  });

  it("muestra scope global cuando el viewing incluye la base", async () => {
    const { container } = renderHubWithCommunity(communityValue());
    await screen.findByText("Catan");
    expect(screen.getByText("toda la comunidad")).toBeInTheDocument();
    // La pista para acotar (destildar TurnoCero) sigue presente.
    expect(container.textContent).toMatch(/destildá/i);
  });

  it("muestra el scope acotado a la comunidad seleccionada", async () => {
    renderHubWithCommunity(communityValue({ effectiveViewing: ["beta"] }));
    await screen.findByText("Catan");
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.queryByText("toda la comunidad")).not.toBeInTheDocument();
  });

  it("no se muestra con una sola comunidad (nada que elegir)", async () => {
    const { container } = renderHubWithCommunity(
      communityValue({
        memberships: [{ community: baseCommunity }],
        effectiveViewing: ["base"],
      }),
    );
    await screen.findByText("Catan");
    expect(container.textContent).not.toMatch(/Estás viendo/i);
  });

  it("no se muestra en modo tenant (subdominio single-community)", async () => {
    const { container } = renderHubWithCommunity(
      communityValue({ isTenant: true }),
    );
    await screen.findByText("Catan");
    expect(container.textContent).not.toMatch(/Estás viendo/i);
  });
});
