import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouterOnly } from "../../test/wrappers/AllProviders";
import AgendaList from "./AgendaList";

const HOST = {
  _id: "u1",
  username: "ana",
  displayName: "Ana",
  avatar: { url: "", publicId: "" },
};

function makeItem(over = {}) {
  return {
    id: over.id || "x1",
    tipo: over.tipo || "evento",
    title: over.title || "Actividad",
    subtitle: over.subtitle || "",
    date: over.date || new Date(2026, 5, 10, 18).toISOString(),
    status: "open",
    url: over.url || "/eventos/x1",
    host: HOST,
  };
}

describe("<AgendaList>", () => {
  it("agrupa por mes y renderiza un header de mes", () => {
    render(
      <RouterOnly>
        <AgendaList
          items={[
            makeItem({
              id: "a",
              title: "Mesa de Junio",
              date: new Date(2026, 5, 10).toISOString(),
            }),
            makeItem({
              id: "b",
              title: "Mesa de Julio",
              date: new Date(2026, 6, 3).toISOString(),
            }),
          ]}
        />
      </RouterOnly>,
    );
    expect(screen.getByText("Junio")).toBeInTheDocument();
    expect(screen.getByText("Julio")).toBeInTheDocument();
  });

  it("renderiza cada item como link a su detalle", () => {
    render(
      <RouterOnly>
        <AgendaList
          items={[makeItem({ title: "Torneo Catán", url: "/torneos/t1" })]}
        />
      </RouterOnly>,
    );
    const link = screen.getByText("Torneo Catán").closest("a");
    expect(link).toHaveAttribute("href", "/torneos/t1");
  });

  it("muestra el contador de actividades por mes", () => {
    render(
      <RouterOnly>
        <AgendaList
          items={[
            makeItem({ id: "a", date: new Date(2026, 5, 10).toISOString() }),
            makeItem({ id: "b", date: new Date(2026, 5, 12).toISOString() }),
          ]}
        />
      </RouterOnly>,
    );
    expect(screen.getByText("2 actividades")).toBeInTheDocument();
  });
});
