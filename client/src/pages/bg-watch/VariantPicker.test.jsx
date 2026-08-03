import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import VariantPicker from "./VariantPicker";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

beforeEach(() => {
  server.use(
    http.get("/api/bgg/variantes/:user/:gameId", () =>
      HttpResponse.json({ items: ["Escenario 1", "Mapa Norte"] }),
    ),
  );
});

function renderVP(props = {}) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <VariantPicker
        bggUsername="me"
        gameId="13"
        value={props.value || ""}
        onPick={props.onPick || vi.fn()}
        onClose={props.onClose || vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("<VariantPicker>", () => {
  it("lista las variantes previas del juego", async () => {
    renderVP();
    expect(await screen.findByText("Escenario 1")).toBeInTheDocument();
    expect(screen.getByText("Mapa Norte")).toBeInTheDocument();
  });

  it("elegir una variante llama onPick + onClose", async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    renderVP({ onPick, onClose });
    fireEvent.click((await screen.findByText("Mapa Norte")).closest("button"));
    expect(onPick).toHaveBeenCalledWith("Mapa Norte");
    expect(onClose).toHaveBeenCalled();
  });

  it("ofrece 'Usar «texto»' para una variante nueva", async () => {
    const onPick = vi.fn();
    renderVP({ onPick });
    await screen.findByText("Escenario 1");
    fireEvent.change(screen.getByLabelText(/variante o tablero/i), {
      target: { value: "Escenario 7" },
    });
    fireEvent.click(screen.getByText(/usar «escenario 7»/i));
    expect(onPick).toHaveBeenCalledWith("Escenario 7");
  });

  it("Enter con texto elige el escrito", async () => {
    const onPick = vi.fn();
    renderVP({ onPick });
    const input = screen.getByLabelText(/variante o tablero/i);
    fireEvent.change(input, { target: { value: "La Tormenta" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith("La Tormenta");
  });
});
