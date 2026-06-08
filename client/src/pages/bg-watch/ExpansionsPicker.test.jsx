import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import ExpansionsPicker from "./ExpansionsPicker";

beforeEach(() => {
  server.use(
    http.get("/api/bgg/game/:id/expansiones", () =>
      HttpResponse.json({
        items: [
          { id: 1, name: "Oceania" },
          { id: 2, name: "Europe" },
        ],
      }),
    ),
  );
});

describe("<ExpansionsPicker>", () => {
  it("lista las expansiones del juego", async () => {
    render(
      <ExpansionsPicker
        gameId="13"
        selected={[]}
        onToggle={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByText("Oceania")).toBeInTheDocument();
    expect(screen.getByText("Europe")).toBeInTheDocument();
  });

  it("togglea al clickear y marca las seleccionadas con ✓", async () => {
    const onToggle = vi.fn();
    render(
      <ExpansionsPicker
        gameId="13"
        selected={[{ id: 1, name: "Oceania" }]}
        onToggle={onToggle}
        onClose={vi.fn()}
      />,
    );
    const oceania = (await screen.findByText("Oceania")).closest("button");
    expect(oceania).toHaveAttribute("aria-pressed", "true");
    expect(oceania).toHaveTextContent("✓");
    fireEvent.click(oceania);
    expect(onToggle).toHaveBeenCalledWith({ id: 1, name: "Oceania" });
  });

  it("muestra el thumbnail de la expansión si lo hay (fallback si no)", async () => {
    server.use(
      http.get("/api/bgg/game/:id/expansiones", () =>
        HttpResponse.json({
          items: [
            { id: 1, name: "Oceania", thumbnail: "https://cdn/oceania.jpg" },
            { id: 2, name: "Europe", thumbnail: null },
          ],
        }),
      ),
    );
    render(
      <ExpansionsPicker
        gameId="13"
        selected={[]}
        onToggle={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const img = await screen.findByAltText("Oceania");
    expect(img).toHaveAttribute("src", "https://cdn/oceania.jpg");
    // Europe sin thumbnail → fallback (sin <img alt="Europe">).
    expect(screen.queryByAltText("Europe")).toBeNull();
  });

  it("filtra client-side por el buscador", async () => {
    render(
      <ExpansionsPicker
        gameId="13"
        selected={[]}
        onToggle={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await screen.findByText("Oceania");
    fireEvent.change(screen.getByPlaceholderText(/buscá una expansión/i), {
      target: { value: "euro" },
    });
    expect(screen.queryByText("Oceania")).toBeNull();
    expect(screen.getByText("Europe")).toBeInTheDocument();
  });

  it("estado vacío si el juego no tiene expansiones", async () => {
    server.use(
      http.get("/api/bgg/game/:id/expansiones", () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    render(
      <ExpansionsPicker
        gameId="13"
        selected={[]}
        onToggle={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      await screen.findByText(/no tiene expansiones/i),
    ).toBeInTheDocument();
  });

  it("la ✕ llama onClose", async () => {
    const onClose = vi.fn();
    render(
      <ExpansionsPicker
        gameId="13"
        selected={[]}
        onToggle={vi.fn()}
        onClose={onClose}
      />,
    );
    await screen.findByText("Oceania");
    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
