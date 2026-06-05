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
    renderCard();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
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
    expect(screen.getByText("NoScore")).toBeInTheDocument();
    expect(screen.getByText("EmptyScore")).toBeInTheDocument();
    expect(screen.getByText("PoisonedScore")).toBeInTheDocument();
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
    expect(screen.getByText("0")).toBeInTheDocument();
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
        <PlayCard
          play={makePlay()}
          userMap={{}}
          onLogAnother={onLogAnother}
        />
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
});
