import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import BgWatchTabSelect from "./BgWatchTabSelect";

const TABS = [
  { id: "partidas", label: "Partidas", badge: 100 },
  { id: "coleccion", label: "Colección", badge: 87 },
  { id: "jugadores", label: "Jugadores", badge: null },
];

function renderSelect(props = {}) {
  const onSelect = props.onSelect || vi.fn();
  const utils = render(
    <BgWatchTabSelect
      tabs={props.tabs || TABS}
      activeId={props.activeId || "partidas"}
      onSelect={onSelect}
    />,
  );
  return { ...utils, onSelect };
}

describe("<BgWatchTabSelect>", () => {
  it("muestra la tab activa con su badge en el botón", () => {
    renderSelect();
    const trigger = screen.getByRole("button", { name: /partidas/i });
    expect(trigger).toHaveTextContent("Partidas");
    expect(trigger).toHaveTextContent("100");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("no muestra el listado hasta abrir", () => {
    renderSelect();
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /partidas/i }));
    const list = screen.getByRole("listbox");
    expect(within(list).getByText("Colección")).toBeInTheDocument();
    expect(within(list).getByText("Jugadores")).toBeInTheDocument();
  });

  it("al elegir una opción dispara onSelect con su id y cierra el listado", () => {
    const { onSelect } = renderSelect();
    fireEvent.click(screen.getByRole("button", { name: /partidas/i }));
    fireEvent.click(screen.getByRole("option", { name: /colección/i }));
    expect(onSelect).toHaveBeenCalledWith("coleccion");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("marca la opción activa con aria-selected", () => {
    renderSelect({ activeId: "coleccion" });
    fireEvent.click(screen.getByRole("button", { name: /colección/i }));
    const active = screen.getByRole("option", { name: /colección/i });
    expect(active).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /partidas/i })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("oculta el badge cuando es null", () => {
    renderSelect();
    fireEvent.click(screen.getByRole("button", { name: /partidas/i }));
    const jugadores = screen.getByRole("option", { name: /jugadores/i });
    expect(jugadores).toHaveTextContent("Jugadores");
    expect(jugadores).not.toHaveTextContent(/\d/);
  });

  it("cierra con Escape", () => {
    renderSelect();
    fireEvent.click(screen.getByRole("button", { name: /partidas/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
