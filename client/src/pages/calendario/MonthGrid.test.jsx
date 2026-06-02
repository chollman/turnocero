import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MonthGrid from "./MonthGrid";
import { groupByDay } from "../../utils/calendar";

function renderGrid(props = {}) {
  const items = props.items || [
    {
      id: "e1",
      tipo: "evento",
      title: "Demo de Wingspan",
      date: new Date(2026, 5, 10, 19),
    },
  ];
  const itemsByDay = groupByDay(items);
  const onSelectDay = props.onSelectDay || vi.fn();
  render(
    <MonthGrid
      year={2026}
      month={5}
      itemsByDay={itemsByDay}
      selectedKey={props.selectedKey || null}
      onSelectDay={onSelectDay}
    />,
  );
  return { onSelectDay };
}

describe("<MonthGrid>", () => {
  it("renderiza 7 encabezados de día (lunes-primero)", () => {
    renderGrid();
    expect(screen.getAllByRole("columnheader")).toHaveLength(7);
  });

  it("muestra el chip del item en su día", () => {
    renderGrid();
    expect(screen.getByText("Demo de Wingspan")).toBeInTheDocument();
  });

  it("llama onSelectDay con la key del día clickeado", () => {
    const { onSelectDay } = renderGrid();
    // El día 10 de junio 2026.
    const cell = screen.getByText("Demo de Wingspan").closest("button");
    fireEvent.click(cell);
    expect(onSelectDay).toHaveBeenCalledWith("2026-06-10");
  });

  it("marca el día seleccionado con aria-pressed", () => {
    renderGrid({ selectedKey: "2026-06-10" });
    const cell = screen.getByText("Demo de Wingspan").closest("button");
    expect(cell).toHaveAttribute("aria-pressed", "true");
  });
});
