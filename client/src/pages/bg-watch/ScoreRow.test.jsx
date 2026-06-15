import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../components/shared/Avatar", () => ({
  default: ({ user }) => <div data-testid="avatar">{user?.username || ""}</div>,
}));

import ScoreRow from "./ScoreRow";

function makePlayer(overrides = {}) {
  return {
    name: "Bob",
    username: "bob",
    score: "",
    win: false,
    new: false,
    anonymous: false,
    team: "A",
    ...overrides,
  };
}

function renderRow(props = {}) {
  return render(
    <ScoreRow
      player={props.player || makePlayer()}
      mode={props.mode || "versus"}
      position={props.position ?? 1}
      leader={props.leader || false}
      isYou={props.isYou || false}
      userMap={props.userMap || {}}
      activeTeams={props.activeTeams || ["A", "B"]}
      canRemove={props.canRemove ?? true}
      onScore={props.onScore || vi.fn()}
      onStep={props.onStep || vi.fn()}
      onTeam={props.onTeam || vi.fn()}
      onToggleWin={props.onToggleWin || vi.fn()}
      onRemove={props.onRemove || vi.fn()}
    />,
  );
}

describe("<ScoreRow>", () => {
  it("versus: muestra el ranking con score y el stepper + trofeo", () => {
    renderRow({ player: makePlayer({ score: "10" }), position: 2 });
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByLabelText(/puntaje de bob/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^ganó$/i })).toBeInTheDocument();
  });

  it("versus sin score muestra — en el ranking", () => {
    renderRow({ player: makePlayer({ score: "" }) });
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("coop: sin stepper, etiqueta de equipo", () => {
    renderRow({ mode: "coop" });
    expect(screen.queryByLabelText(/puntaje de/i)).toBeNull();
    expect(screen.getByText("Equipo")).toBeInTheDocument();
  });

  it("equipos: stepper + selector A/B y dispara onTeam", () => {
    const onTeam = vi.fn();
    renderRow({ mode: "equipos", onTeam });
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    expect(onTeam).toHaveBeenCalledWith("B");
  });

  it("equipos: muestra el label 'Elegí el equipo:'; versus no", () => {
    const { unmount } = renderRow({ mode: "equipos" });
    expect(screen.getByText(/elegí el equipo:/i)).toBeInTheDocument();
    unmount();
    renderRow({ mode: "versus" });
    expect(screen.queryByText(/elegí el equipo:/i)).toBeNull();
  });

  it("equipos: la fila lleva la clase scoreRowTeams (layout de dos líneas en mobile); otros modos no", () => {
    const { container: teams } = renderRow({ mode: "equipos" });
    expect(teams.firstChild.className).toMatch(/scoreRowTeams/);
    const { container: versus } = renderRow({ mode: "versus" });
    expect(versus.firstChild.className).not.toMatch(/scoreRowTeams/);
    const { container: coop } = renderRow({ mode: "coop" });
    expect(coop.firstChild.className).not.toMatch(/scoreRowTeams/);
  });

  it("líder muestra la corona; el toggle de ganó llama onToggleWin", () => {
    const onToggleWin = vi.fn();
    renderRow({ leader: true, onToggleWin });
    fireEvent.click(screen.getByRole("button", { name: /^ganó$/i }));
    expect(onToggleWin).toHaveBeenCalled();
  });

  it("anónimo: avatar fantasma + tag, sin @handle", () => {
    renderRow({
      player: makePlayer({
        name: "Jugador anónimo 1",
        username: "",
        anonymous: true,
      }),
    });
    expect(screen.getByText("👤")).toBeInTheDocument();
    expect(screen.getByText("anónimo")).toBeInTheDocument();
    expect(screen.queryByText(/^@/)).toBeNull();
  });

  it('"vos" no muestra botón de quitar (placeholder); otros sí', () => {
    const onRemove = vi.fn();
    const { unmount } = renderRow({ isYou: true, onRemove });
    expect(
      screen.queryByRole("button", { name: /quitar jugador/i }),
    ).toBeNull();
    unmount();
    renderRow({ isYou: false, onRemove });
    fireEvent.click(screen.getByRole("button", { name: /quitar jugador/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("con canRemove=false no hay botón de quitar (un solo jugador)", () => {
    renderRow({ canRemove: false });
    expect(
      screen.queryByRole("button", { name: /quitar jugador/i }),
    ).toBeNull();
  });

  it("los pasos +/- del stepper disparan onStep", () => {
    const onStep = vi.fn();
    renderRow({ onStep });
    fireEvent.click(screen.getByRole("button", { name: /subir puntaje/i }));
    expect(onStep).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: /bajar puntaje/i }));
    expect(onStep).toHaveBeenCalledWith(-1);
  });
});
