import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../components/shared/Avatar", () => ({
  default: ({ user, className }) => (
    <div data-testid="avatar" className={className || ""}>
      {user?.username || ""}
    </div>
  ),
}));

import PlayCard from "./PlayCard";

function makePlay(overrides = {}) {
  return {
    id: "p1",
    gameName: "Catán",
    gameThumbnail: "https://cdn/catan.jpg",
    date: "2026-05-01",
    location: "Buenos Aires",
    duration: 90,
    quantity: 1,
    comments: "",
    incomplete: false,
    players: [
      { name: "Alice", username: "alice", score: "10", win: true, position: 1 },
      { name: "Bob", username: "bob", score: "7", win: false, position: 2 },
    ],
    ...overrides,
  };
}

function renderCard(props = {}) {
  return render(
    <MemoryRouter>
      <PlayCard
        play={makePlay(props.play)}
        userMap={props.userMap || {}}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("<PlayCard>", () => {
  it("renders the game name and thumbnail", () => {
    renderCard();
    expect(screen.getByText("Catán")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Catán" })).toHaveAttribute(
      "src",
      "https://cdn/catan.jpg",
    );
  });

  it("shows dice fallback when no thumbnail", () => {
    renderCard({ play: { gameThumbnail: null } });
    expect(screen.getByText("🎲")).toBeInTheDocument();
  });

  it("renders all players with scores", () => {
    // Desktop: chips de todos los jugadores. Mobile: sólo la línea de ganador
    // + la columna derecha (puntaje). La visibilidad la resuelve CSS según el
    // breakpoint; en el DOM conviven ambas estructuras.
    renderCard();
    // Nombres: sólo en los chips de desktop (la línea mobile son avatares, sin
    // texto de nombre).
    expect(screen.getAllByText("Alice")).toHaveLength(1);
    expect(screen.getAllByText("Bob")).toHaveLength(1);
    // Score de Alice: chip + columna derecha (cae al puntaje del ganador
    // cuando no hay asiento del dueño).
    expect(screen.getAllByText("10")).toHaveLength(2);
    // Score de Bob: sólo el chip.
    expect(screen.getAllByText("7")).toHaveLength(1);
  });

  it('omits score entirely when a player has no score (null / empty / "null")', () => {
    renderCard({
      play: {
        players: [
          {
            name: "NoScore",
            username: "ns",
            score: null,
            win: false,
            position: 1,
          },
          {
            name: "EmptyScore",
            username: "es",
            score: "",
            win: false,
            position: 2,
          },
          {
            name: "PoisonedScore",
            username: "ps",
            score: "null",
            win: false,
            position: 3,
          },
        ],
      },
    });
    expect(screen.getAllByText("NoScore").length).toBeGreaterThan(0);
    expect(screen.getAllByText("EmptyScore").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PoisonedScore").length).toBeGreaterThan(0);
    // No "null" text should be rendered anywhere (data-poisoning guard).
    expect(screen.queryByText("null")).toBeNull();
    expect(screen.queryByText(/^null$/i)).toBeNull();
  });

  it('renders score "0" as a real score (not filtered as falsy)', () => {
    renderCard({
      play: {
        players: [
          { name: "Zero", username: "z", score: "0", win: true, position: 1 },
        ],
      },
    });
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  });

  it("renders the win trophy icon for the winner", () => {
    renderCard();
    const trophies = screen.getAllByLabelText("Ganador");
    expect(trophies).toHaveLength(1);
  });

  it("renders the 'Nuevo' indicator for players who played it for the first time", () => {
    renderCard({
      play: {
        players: [
          {
            name: "Alice",
            username: "alice",
            win: true,
            new: true,
            position: 1,
          },
          { name: "Bob", username: "bob", win: false, new: false, position: 2 },
        ],
      },
    });
    expect(screen.getAllByLabelText("Nuevo")).toHaveLength(1);
  });

  it("renders location and duration in the meta line", () => {
    renderCard();
    // La fila tipo almanaque del handoff muestra lugar · duración · jugadores
    // en una sola meta-línea (los tags/comentarios viven en el detalle).
    expect(screen.getAllByText(/Buenos Aires/).length).toBeGreaterThan(0);
    expect(screen.getByText(/90 min/)).toBeInTheDocument();
  });

  it("does not render quantity / incompleta / comment tags on the card", () => {
    // La card pasó a la fila compacta del handoff: cantidad, 'Incompleta' y el
    // comentario se ven en el detalle de la partida, no en el listado.
    renderCard({
      play: { quantity: 3, incomplete: true, comments: "x".repeat(120) },
    });
    expect(screen.queryByText(/×3 partidas/)).not.toBeInTheDocument();
    expect(screen.queryByText(/incompleta/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/x{80}…/)).not.toBeInTheDocument();
  });

  it("links a player chip to /usuarios/:id when turnoceroUser is provided in userMap", () => {
    renderCard({
      userMap: {
        alice: { _id: "u1", username: "alice", displayName: "Alice T" },
      },
    });
    const link = screen.getByRole("link", { name: /alice/i });
    expect(link).toHaveAttribute("href", "/usuarios/u1");
  });

  it("un override local (overlayName) gana sobre el nombre del miembro de TurnoCero", () => {
    renderCard({
      play: {
        players: [
          {
            name: "Alias",
            overlayName: "Alias",
            username: "alice",
            win: true,
            position: 1,
          },
        ],
      },
      userMap: {
        alice: { _id: "u1", username: "alice", displayName: "Alice T" },
      },
    });
    // Muestra el override, no el displayName de TurnoCero, pero sigue linkeando
    // al perfil del miembro.
    const link = screen.getByRole("link", { name: /alias/i });
    expect(link).toHaveAttribute("href", "/usuarios/u1");
    expect(screen.queryByText("Alice T")).toBeNull();
  });

  it("calls onClick when card is clicked (when interactive)", () => {
    const onClick = vi.fn();
    render(
      <MemoryRouter>
        <PlayCard play={makePlay()} userMap={{}} onClick={onClick} />
      </MemoryRouter>,
    );
    // Click the card root via the game name text
    fireEvent.click(screen.getByText("Catán"));
    expect(onClick).toHaveBeenCalled();
  });

  it("opens the action menu and triggers onEdit/onDelete", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <MemoryRouter>
        <PlayCard
          play={makePlay()}
          userMap={{}}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Acciones" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /editar/i }));
    expect(onEdit).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Acciones" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /eliminar/i }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("muestra 'Cargar otra partida' y dispara onLogAnother", () => {
    const onLogAnother = vi.fn();
    render(
      <MemoryRouter>
        <PlayCard play={makePlay()} userMap={{}} onLogAnother={onLogAnother} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Acciones" }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: /cargar otra partida/i }),
    );
    expect(onLogAnother).toHaveBeenCalled();
  });

  it("closes the menu on Escape", () => {
    render(
      <MemoryRouter>
        <PlayCard play={makePlay()} userMap={{}} onEdit={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Acciones" }));
    expect(
      screen.getByRole("menuitem", { name: /editar/i }),
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("menuitem", { name: /editar/i }),
    ).not.toBeInTheDocument();
  });

  it("sorts winners to the front of players", () => {
    render(
      <MemoryRouter>
        <PlayCard
          play={makePlay({
            players: [
              {
                name: "Loser",
                username: "l",
                score: "5",
                win: false,
                position: 2,
              },
              {
                name: "Winner",
                username: "w",
                score: "15",
                win: true,
                position: 1,
              },
            ],
          })}
          userMap={{}}
        />
      </MemoryRouter>,
    );
    const names = screen.getAllByText(/Loser|Winner/);
    expect(names[0].textContent).toBe("Winner");
    expect(names[1].textContent).toBe("Loser");
  });

  describe("vista mobile (línea de ganador + meta + columna derecha)", () => {
    it("muestra la fecha como badge día/mes", () => {
      const { container } = renderCard({ play: { date: "2026-05-18" } });
      const badge = container.querySelector(".playDateBadge");
      expect(badge).not.toBeNull();
      expect(badge.textContent).toContain("18");
      expect(badge.textContent.toLowerCase()).toContain("may");
    });

    it("muestra la meta compacta con lugar y cantidad de jugadores", () => {
      const { container } = renderCard();
      const meta = container.querySelector(".playMeta");
      expect(meta).not.toBeNull();
      expect(meta.textContent).toContain("Buenos Aires");
      expect(meta.textContent).toContain("2 jug.");
    });

    it("la línea de ganador no lleva texto 'Ganó' (sólo corona + avatares)", () => {
      const { container } = renderCard();
      const line = container.querySelector(".playWinnerLine");
      expect(line).not.toBeNull();
      expect(line.textContent).not.toContain("Ganó");
      expect(line.querySelector(".playWinnerText")).toBeNull();
      expect(line.querySelector(".playWinnerCrown")).not.toBeNull();
    });

    it("muestra todos los avatares del roster, con el ganador primero y separado del resto", () => {
      const { container } = renderCard({
        play: {
          players: [
            { name: "Loser", username: "lo", win: false, position: 2 },
            { name: "Winner", username: "wi", win: true, position: 1 },
          ],
        },
      });
      const items = container
        .querySelector(".playWinnerAvatars")
        .querySelectorAll("[data-testid='avatar']");
      expect(items).toHaveLength(2);
      // Ganador primero (pegado a la corona).
      expect(items[0].textContent).toBe("wi");
      expect(items[0].className).not.toContain("rosterSplit");
      // El primer no-ganador abre el gap de separación; nadie queda atenuado.
      expect(items[1].textContent).toBe("lo");
      expect(items[1].className).toContain("rosterSplit");
      expect(container.querySelector(".winnerAvatarMuted")).toBeNull();
    });

    it("en victoria colectiva la línea de ganador no lleva texto (solo corona + avatares)", () => {
      const { container } = renderCard({
        play: {
          players: [
            { name: "Ana", username: "ana", win: true, position: 1 },
            { name: "Beto", username: "beto", win: true, position: 1 },
          ],
        },
      });
      const line = container.querySelector(".playWinnerLine");
      expect(line).not.toBeNull();
      // No "Ganó/Ganaron" ni nombres al lado del avatar — eso va a la derecha.
      expect(line.querySelector(".playWinnerText")).toBeNull();
      expect(line.textContent).not.toContain("Ganaron");
    });

    it("en victoria colectiva la columna derecha muestra 'Ganaron en equipo' en vez del puesto", () => {
      const { container } = renderCard({
        play: {
          players: ["A", "B", "C"].map((n) => ({
            name: n,
            username: n.toLowerCase(),
            win: true,
            position: 1,
          })),
        },
        bggUsername: "a",
      });
      const right = container.querySelector(".playRight");
      expect(right).not.toBeNull();
      expect(right.textContent).toContain("Ganaron en equipo");
      // Reemplaza el puesto: no hay pastilla "Nº de N".
      expect(right.querySelector(".playRankPill")).toBeNull();
      expect(right.querySelector(".playTeamResultWin")).not.toBeNull();
    });

    it("en derrota de equipo (dueño fuera de los ganadores) la derecha dice 'Perdieron'", () => {
      const { container } = renderCard({
        play: {
          players: [
            { name: "Ana", username: "ana", win: true, position: 1 },
            { name: "Beto", username: "beto", win: true, position: 1 },
            { name: "Vos", username: "vos", win: false, position: 3 },
          ],
        },
        bggUsername: "vos",
      });
      const right = container.querySelector(".playRight");
      expect(right.textContent).toContain("Perdieron");
      expect(right.querySelector(".playTeamResultLoss")).not.toBeNull();
      expect(right.querySelector(".playRankPill")).toBeNull();
    });

    it("la columna derecha muestra el puesto del dueño sobre el total + su puntaje", () => {
      const { container } = renderCard({
        play: {
          players: [
            {
              name: "Alice",
              username: "alice",
              score: "10",
              win: true,
              position: 1,
            },
            {
              name: "Vos",
              username: "vos",
              score: "8",
              win: false,
              position: 2,
            },
          ],
        },
        bggUsername: "vos",
      });
      const right = container.querySelector(".playRight");
      expect(right).not.toBeNull();
      expect(right.textContent).toContain("2º de 2");
      expect(right.textContent).toContain("8");
      // Perdió → pastilla muted, no la verde de victoria.
      expect(right.querySelector(".playRankPillLoss")).not.toBeNull();
      expect(right.querySelector(".playRankPillWin")).toBeNull();
    });

    it("sin asiento del dueño no muestra pastilla de puesto pero cae al puntaje del ganador", () => {
      const { container } = renderCard();
      const right = container.querySelector(".playRight");
      expect(right).not.toBeNull();
      expect(right.querySelector(".playRankPill")).toBeNull();
      expect(right.textContent).toContain("10");
    });

    it("resuelve el nombre del ganador con overlayName por sobre el de TurnoCero", () => {
      renderCard({
        play: {
          players: [
            {
              name: "Alias",
              overlayName: "Alias",
              username: "alice",
              win: true,
              position: 1,
            },
          ],
        },
        userMap: {
          alice: { _id: "u1", username: "alice", displayName: "Alice T" },
        },
      });
      // El override gana sobre el displayName de TurnoCero en el chip (la
      // línea mobile ya no muestra nombres, sólo avatares).
      expect(screen.queryByText("Alice T")).toBeNull();
      expect(screen.getAllByText("Alias").length).toBeGreaterThan(0);
    });
  });

  describe("chip de resultado del dueño (desktop)", () => {
    it("partida individual: dice Ganaste / Perdiste", () => {
      const win = renderCard({ bggUsername: "alice" });
      expect(win.container.querySelector(".playOutcome").textContent).toContain(
        "Ganaste",
      );
      win.unmount();
      const loss = renderCard({ bggUsername: "bob" });
      expect(
        loss.container.querySelector(".playOutcome").textContent,
      ).toContain("Perdiste");
    });

    it("partida por equipos: el chip dice lo mismo que mobile (Ganaron en equipo / Perdieron)", () => {
      const win = renderCard({
        play: {
          players: [
            { name: "Vos", username: "vos", win: true, position: 1 },
            { name: "Ana", username: "ana", win: true, position: 1 },
            { name: "Riv", username: "riv", win: false, position: 3 },
          ],
        },
        bggUsername: "vos",
      });
      const winChip = win.container.querySelector(".playOutcome");
      expect(winChip.textContent).toContain("Ganaron en equipo");
      expect(winChip.className).toContain("playOutcomeWin");
      win.unmount();

      const loss = renderCard({
        play: {
          players: [
            { name: "Ana", username: "ana", win: true, position: 1 },
            { name: "Beto", username: "beto", win: true, position: 1 },
            { name: "Vos", username: "vos", win: false, position: 3 },
          ],
        },
        bggUsername: "vos",
      });
      const lossChip = loss.container.querySelector(".playOutcome");
      expect(lossChip.textContent).toContain("Perdieron");
      expect(lossChip.className).toContain("playOutcomeLoss");
    });
  });

  describe("acento de victoria del dueño", () => {
    it("marca la card con playCardWin cuando el dueño del perfil ganó", () => {
      const { container } = renderCard({ bggUsername: "alice" });
      expect(container.firstChild.className).toContain("playCardWin");
    });

    it("no marca la card cuando el dueño perdió o no jugó", () => {
      const { container } = renderCard({ bggUsername: "bob" });
      expect(container.firstChild.className).not.toContain("playCardWin");
    });
  });
});
