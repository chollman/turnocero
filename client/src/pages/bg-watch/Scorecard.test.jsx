import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../components/shared/Avatar", () => ({
  default: ({ user }) => <div data-testid="avatar">{user?.username || ""}</div>,
}));

import Scorecard, { gameInitials, deriveWinnerLabel } from "./Scorecard";

const inRouter = (ui) => render(ui, { wrapper: MemoryRouter });

function row(over = {}) {
  return {
    key: over.key || over.name || "k",
    name: "Jugador",
    username: "",
    anonymous: false,
    score: "",
    win: false,
    new: false,
    position: 1,
    you: false,
    leader: false,
    ...over,
  };
}

describe("gameInitials", () => {
  it("toma iniciales de 2 palabras o 2 letras", () => {
    expect(gameInitials("Terraforming Mars")).toBe("TM");
    expect(gameInitials("Catan")).toBe("CA");
    expect(gameInitials("")).toBe("?");
  });
});

describe("<Scorecard>", () => {
  it("muestra placeholder sin juego", () => {
    render(<Scorecard rows={[]} />);
    expect(screen.getByText("Elegí un juego")).toBeInTheDocument();
    expect(screen.getByText("Sin jugadores todavía")).toBeInTheDocument();
  });

  it("muestra el nombre del juego elegido", () => {
    render(<Scorecard game={{ name: "Wingspan" }} rows={[]} />);
    expect(screen.getByText("Wingspan")).toBeInTheDocument();
  });

  it("banner vacío cuando no hay resultado (versus)", () => {
    render(
      <Scorecard
        game={{ name: "X" }}
        mode="versus"
        hasResult={false}
        rows={[row({ name: "Ana" })]}
      />,
    );
    expect(screen.getByText(/cargá los puntajes/i)).toBeInTheDocument();
  });

  it("banner de victoria cuando ganás (versus)", () => {
    render(
      <Scorecard
        game={{ name: "X" }}
        mode="versus"
        hasResult
        youWin
        rows={[row({ name: "Vos", you: true, leader: true, score: "10" })]}
      />,
    );
    expect(screen.getByText(/¡ganaste!/i)).toBeInTheDocument();
  });

  it("banner de derrota cuando perdés (versus)", () => {
    render(
      <Scorecard
        game={{ name: "X" }}
        mode="versus"
        hasResult
        youWin={false}
        rows={[row({ name: "Vos", you: true, score: "3" })]}
      />,
    );
    expect(screen.getByText(/perdiste/i)).toBeInTheDocument();
  });

  it("ordena las filas por posición (rank) en versus", () => {
    render(
      <Scorecard
        game={{ name: "X" }}
        mode="versus"
        hasResult
        rows={[
          row({ key: "a", name: "Ana", position: 2, score: "5" }),
          row({
            key: "b",
            name: "Beto",
            position: 1,
            score: "9",
            leader: true,
          }),
        ]}
      />,
    );
    const names = screen.getAllByText(/Ana|Beto/).map((n) => n.textContent);
    expect(names[0]).toMatch(/Beto/);
    expect(names[1]).toMatch(/Ana/);
  });

  it("en coop muestra el banner de equipo", () => {
    render(
      <Scorecard
        game={{ name: "Pandemic" }}
        mode="coop"
        hasResult
        youWin
        rows={[
          row({ name: "Vos", win: true }),
          row({ key: "b", name: "Ana", win: true }),
        ]}
      />,
    );
    expect(screen.getByText(/¡ganaron!/i)).toBeInTheDocument();
  });

  it("el anónimo se muestra con avatar fantasma (sin <Avatar>)", () => {
    render(
      <Scorecard
        game={{ name: "X" }}
        mode="versus"
        rows={[row({ name: "Jugador anónimo 1", anonymous: true })]}
      />,
    );
    expect(screen.getByText("Jugador anónimo 1")).toBeInTheDocument();
    expect(screen.queryByTestId("avatar")).toBeNull();
    expect(screen.getByText("👤")).toBeInTheDocument();
  });

  // ── publicView (juntada compartida) ──────────────────────────────────
  it("publicView versus: banner muestra al ganador, no '¡Ganaste!'", () => {
    render(
      <Scorecard
        game={{ name: "X" }}
        mode="versus"
        publicView
        rows={[
          row({ name: "Beto", position: 1, score: "9", win: true, leader: true }),
          row({ key: "a", name: "Ana", position: 2, score: "5" }),
        ]}
      />,
    );
    expect(screen.getByText(/ganó beto/i)).toBeInTheDocument();
    expect(screen.queryByText(/¡ganaste!/i)).not.toBeInTheDocument();
  });

  it("publicView suprime '(vos)' y el highlight propio", () => {
    render(
      <Scorecard
        game={{ name: "X" }}
        mode="versus"
        publicView
        rows={[row({ name: "Beto", you: true, score: "9", win: true })]}
      />,
    );
    expect(screen.queryByText(/\(vos\)/)).not.toBeInTheDocument();
  });

  it("publicView: el nombre linkea al perfil público cuando hay profileHref", () => {
    inRouter(
      <Scorecard
        game={{ name: "X" }}
        mode="versus"
        publicView
        rows={[
          row({
            name: "Martín",
            username: "martin",
            score: "9",
            profileHref: "/usuarios/u1",
            bgwatchHref: "/bg-watch/martin",
          }),
        ]}
      />,
    );
    const nameLink = screen.getByRole("link", { name: "Martín" });
    expect(nameLink).toHaveAttribute("href", "/usuarios/u1");
  });

  it("publicView: link a BG Watch solo si bgwatchEnabled", () => {
    const { rerender } = inRouter(
      <Scorecard
        game={{ name: "X" }}
        mode="versus"
        publicView
        bgwatchEnabled={false}
        rows={[row({ name: "Mika", username: "Mica_ki", bgwatchHref: "/bg-watch/Mica_ki" })]}
      />,
    );
    // Sección deshabilitada → sin link de BG Watch.
    expect(screen.queryByRole("link", { name: /BG Watch/i })).toBeNull();

    rerender(
      <Scorecard
        game={{ name: "X" }}
        mode="versus"
        publicView
        bgwatchEnabled
        rows={[row({ name: "Mika", username: "Mica_ki", bgwatchHref: "/bg-watch/Mica_ki" })]}
      />,
    );
    const bgw = screen.getByRole("link", { name: /Ver BG Watch de Mika/i });
    expect(bgw).toHaveAttribute("href", "/bg-watch/Mica_ki");
  });

  it("publicView: sin profileHref el nombre es texto plano (no link)", () => {
    inRouter(
      <Scorecard
        game={{ name: "X" }}
        mode="versus"
        publicView
        bgwatchEnabled
        rows={[row({ name: "Lean BG", username: "" })]}
      />,
    );
    expect(screen.queryByRole("link", { name: "Lean BG" })).toBeNull();
    expect(screen.getByText("Lean BG")).toBeInTheDocument();
  });

  it("publicView coop: '¡Ganaron!' / 'Perdieron' según los win", () => {
    const { rerender } = render(
      <Scorecard
        game={{ name: "Pandemic" }}
        mode="coop"
        publicView
        rows={[row({ name: "Ana", win: true })]}
      />,
    );
    expect(screen.getByText(/¡ganaron!/i)).toBeInTheDocument();
    rerender(
      <Scorecard
        game={{ name: "Pandemic" }}
        mode="coop"
        publicView
        rows={[row({ name: "Ana", win: false })]}
      />,
    );
    expect(screen.getByText(/perdieron/i)).toBeInTheDocument();
  });
});

describe("deriveWinnerLabel", () => {
  const r = (over) => ({ name: "P", win: false, team: "", ...over });
  it("coop", () => {
    expect(deriveWinnerLabel([r({ win: true })], "coop")).toEqual({
      label: "¡Ganaron!",
      state: "win",
    });
    expect(deriveWinnerLabel([r()], "coop")).toEqual({
      label: "Perdieron",
      state: "loss",
    });
  });
  it("equipos", () => {
    expect(
      deriveWinnerLabel([r({ win: true, team: "A" }), r({ name: "Q" })], "equipos"),
    ).toEqual({ label: "Ganó el Equipo A", state: "win" });
    expect(deriveWinnerLabel([r()], "equipos")).toEqual({
      label: "Sin resultado",
      state: "empty",
    });
  });
  it("versus: único ganador / empate / sin resultado", () => {
    expect(
      deriveWinnerLabel([r({ name: "Beto", win: true }), r({ name: "Ana" })], "versus"),
    ).toEqual({ label: "Ganó Beto", state: "win" });
    expect(
      deriveWinnerLabel(
        [r({ name: "Beto", win: true }), r({ name: "Ana", win: true })],
        "versus",
      ),
    ).toEqual({ label: "Empate", state: "win" });
    expect(deriveWinnerLabel([r()], "versus")).toEqual({
      label: "Sin resultado",
      state: "empty",
    });
  });
});
