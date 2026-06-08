import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock del buscador BGG: botones que eligen juegos fijos (evita debounce/MSW).
vi.mock("../../components/shared/BggGameSearch", () => ({
  default: ({ onPick }) => (
    <>
      <button
        type="button"
        onClick={() =>
          onPick({ id: 13, name: "Catan", thumbnail: "t.jpg", year: 1995 })
        }
      >
        mock-pick-game
      </button>
      <button
        type="button"
        onClick={() =>
          onPick({ id: 99, name: "Wingspan", thumbnail: "w.jpg", year: 2019 })
        }
      >
        mock-pick-game-2
      </button>
    </>
  ),
}));

import JuntadaFields from "./JuntadaFields";

const EMPTY = { privacy: "public", games: [], title: "", body: "", images: [] };

function Harness({ initial = EMPTY, onValue }) {
  const [value, setValue] = useState(initial);
  return (
    <JuntadaFields
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
    />
  );
}

describe("<JuntadaFields>", () => {
  it("renderiza visibilidad, título, texto y botón de foto", () => {
    render(<Harness />);
    expect(screen.getByPlaceholderText(/título/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /foto/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Público" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Amigos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Solo yo" })).toBeInTheDocument();
  });

  it("cambia la privacidad al clickear un botón", () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    fireEvent.click(screen.getByRole("button", { name: "Amigos" }));
    expect(onValue).toHaveBeenLastCalledWith(
      expect.objectContaining({ privacy: "friends" }),
    );
    expect(
      screen.getByRole("button", { name: "Amigos" }).className,
    ).toMatch(/active/i);
  });

  it("escribir texto emite el value con body", () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    fireEvent.change(
      screen.getByPlaceholderText(/cont[aá] c[oó]mo sali[oó]/i),
      { target: { value: "noche de juegos" } },
    );
    expect(onValue).toHaveBeenLastCalledWith(
      expect.objectContaining({ body: "noche de juegos" }),
    );
  });

  it("agrega varios juegos (chips removibles) y dedupea el mismo", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "mock-pick-game" }));
    fireEvent.click(screen.getByRole("button", { name: "mock-pick-game-2" }));
    expect(
      screen.getByRole("button", { name: /quitar catan/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /quitar wingspan/i }),
    ).toBeInTheDocument();
    // Re-elegir Catan no agrega un segundo chip.
    fireEvent.click(screen.getByRole("button", { name: "mock-pick-game" }));
    expect(
      screen.getAllByRole("button", { name: /quitar catan/i }),
    ).toHaveLength(1);
  });

  it("quitar un juego saca su chip", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "mock-pick-game" }));
    fireEvent.click(screen.getByRole("button", { name: /quitar catan/i }));
    expect(
      screen.queryByRole("button", { name: /quitar catan/i }),
    ).not.toBeInTheDocument();
  });

  it("agregar una foto muestra el contador y quitarla lo saca", () => {
    render(<Harness />);
    const input = document.querySelector('input[type="file"]');
    const file = new File(["img"], "p.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(
      screen.getByRole("button", { name: /foto \(1\/3\)/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /quitar foto/i }));
    expect(
      screen.queryByRole("button", { name: /foto \(1\/3\)/i }),
    ).not.toBeInTheDocument();
  });

  it("el botón de foto se deshabilita con 3 fotos", () => {
    render(<Harness />);
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, {
      target: {
        files: [
          new File(["1"], "a.jpg", { type: "image/jpeg" }),
          new File(["2"], "b.jpg", { type: "image/jpeg" }),
          new File(["3"], "c.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    expect(
      screen.getByRole("button", { name: /foto \(3\/3\)/i }),
    ).toBeDisabled();
  });
});
