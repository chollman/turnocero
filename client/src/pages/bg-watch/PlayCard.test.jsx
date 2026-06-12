import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../components/shared/Avatar", () => ({
  default: ({ user }) => <div data-testid="avatar">{user?.username || ""}</div>,
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
    // Cada jugador aparece dos veces en el DOM: chips (desktop) + podio
    // (mobile); la visibilidad la resuelve CSS según el breakpoint.
    renderCard();
    expect(screen.getAllByText("Alice")).toHaveLength(2);
    expect(screen.getAllByText("Bob")).toHaveLength(2);
    expect(screen.getAllByText("10")).toHaveLength(2);
    expect(screen.getAllByText("7")).toHaveLength(2);
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

  it("renders location, duration tags", () => {
    renderCard();
    expect(screen.getByText(/Buenos Aires/)).toBeInTheDocument();
    expect(screen.getByText(/90 min/)).toBeInTheDocument();
  });

  it("renders quantity tag when quantity > 1", () => {
    renderCard({ play: { quantity: 3 } });
    expect(screen.getByText(/×3 partidas/)).toBeInTheDocument();
  });

  it("renders Incompleta tag when incomplete", () => {
    renderCard({ play: { incomplete: true } });
    expect(screen.getByText(/incompleta/i)).toBeInTheDocument();
  });

  it("truncates long comments to 80 chars + ellipsis", () => {
    renderCard({ play: { comments: "x".repeat(120) } });
    const tag = screen.getByText(/x{80}…/);
    expect(tag).toBeInTheDocument();
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

  describe("podio mobile", () => {
    it("destaca al ganador con su score y lista el resto como texto", () => {
      const { container } = renderCard();
      const podium = container.querySelector(".playPodium");
      expect(podium).not.toBeNull();
      const winners = podium.querySelector(".podiumWinners");
      expect(winners.textContent).toContain("Alice");
      expect(winners.textContent).toContain("10");
      const rest = podium.querySelector(".podiumRest");
      expect(rest.textContent).toContain("Bob");
      expect(rest.textContent).toContain("7");
    });

    it("colapsa los jugadores que exceden el cupo en una pastilla +N", () => {
      const players = [
        { name: "Win", username: "w", score: "20", win: true, position: 1 },
        ...["P2", "P3", "P4", "P5", "P6"].map((name, i) => ({
          name,
          username: name.toLowerCase(),
          score: String(10 - i),
          win: false,
          position: i + 2,
        })),
      ];
      const { container } = renderCard({ play: { players } });
      // 5 perdedores, 3 visibles → +2
      expect(screen.getByText("+2")).toBeInTheDocument();
      const rest = container.querySelector(".podiumRest");
      expect(rest.textContent).toContain("P2");
      expect(rest.textContent).toContain("P4");
      expect(rest.textContent).not.toContain("P5");
    });

    it("sin ganadores muestra hasta 4 jugadores antes del +N", () => {
      const players = ["A1", "A2", "A3", "A4", "A5"].map((name, i) => ({
        name,
        username: name.toLowerCase(),
        score: null,
        win: false,
        position: i + 1,
      }));
      const { container } = renderCard({ play: { players } });
      expect(container.querySelector(".podiumWinners")).toBeNull();
      const rest = container.querySelector(".podiumRest");
      expect(rest.textContent).toContain("A4");
      expect(screen.getByText("+1")).toBeInTheDocument();
    });

    it("resuelve el nombre del podio con overlayName y displayName de TurnoCero", () => {
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
      // Override gana en chips Y en podio.
      expect(screen.queryByText("Alice T")).toBeNull();
      expect(screen.getAllByText("Alias").length).toBeGreaterThan(0);
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
