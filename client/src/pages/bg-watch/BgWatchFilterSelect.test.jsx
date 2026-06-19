import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import BgWatchFilterSelect from "./BgWatchFilterSelect";

const FILTERS = [
  { id: "all", label: "Todas" },
  { id: "year", label: "Este año" },
  { id: "month", label: "Este mes" },
  { id: "7d", label: "7 días" },
];

function renderSelect(props = {}) {
  const onSelect = props.onSelect || vi.fn();
  const utils = render(
    <BgWatchFilterSelect
      filters={props.filters || FILTERS}
      activeId={props.activeId || "all"}
      onSelect={onSelect}
    />,
  );
  return { ...utils, onSelect };
}

describe("<BgWatchFilterSelect>", () => {
  it("muestra el filtro activo en el botón", () => {
    renderSelect({ activeId: "month" });
    const trigger = screen.getByRole("button", { name: /este mes/i });
    expect(trigger).toHaveTextContent("Este mes");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("no muestra el listado hasta abrir", () => {
    renderSelect();
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /todas/i }));
    const list = screen.getByRole("listbox");
    expect(within(list).getByText("Este año")).toBeInTheDocument();
    expect(within(list).getByText("7 días")).toBeInTheDocument();
  });

  it("al elegir una opción dispara onSelect con su id y cierra el listado", () => {
    const { onSelect } = renderSelect();
    fireEvent.click(screen.getByRole("button", { name: /todas/i }));
    fireEvent.click(screen.getByRole("option", { name: /este año/i }));
    expect(onSelect).toHaveBeenCalledWith("year");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("marca la opción activa con aria-selected", () => {
    renderSelect({ activeId: "7d" });
    fireEvent.click(screen.getByRole("button", { name: /7 días/i }));
    expect(screen.getByRole("option", { name: /7 días/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("option", { name: /todas/i })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("cierra con Escape", () => {
    renderSelect();
    fireEvent.click(screen.getByRole("button", { name: /todas/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
