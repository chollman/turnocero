import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AllProviders } from "../../../test/wrappers/AllProviders";
import ResultsView from "./ResultsView";

const baseCycle = {
  length: 2,
  items: [
    {
      itemId: "a",
      owner: { _id: "u1", username: "ana" },
      gameId: 1,
      gameName: "Catan",
      receivesItemId: "b",
      receivesGameId: 2,
      receivesGameName: "Wingspan",
    },
    {
      itemId: "b",
      owner: { _id: "u2", username: "beto" },
      gameId: 2,
      gameName: "Wingspan",
      receivesItemId: "a",
      receivesGameId: 1,
      receivesGameName: "Catan",
    },
  ],
};

const results = {
  summary: {
    itemsOffered: 4,
    itemsTraded: 2,
    cyclesCount: 1,
    longestCycle: 2,
    approximate: false,
  },
  cycles: [baseCycle],
};

describe("ResultsView", () => {
  it("muestra las stats del resumen", () => {
    render(<ResultsView results={results} />, { wrapper: AllProviders });
    expect(screen.getByText("juegos intercambiados")).toBeInTheDocument();
    expect(screen.getByText("cadena más larga")).toBeInTheDocument();
    expect(screen.getByText(/Todas las cadenas \(1\)/)).toBeInTheDocument();
  });

  it("muestra el banner de aproximado cuando corresponde", () => {
    render(
      <ResultsView
        results={{
          ...results,
          summary: { ...results.summary, approximate: true },
        }}
      />,
      { wrapper: AllProviders },
    );
    expect(screen.getByText(/Resultado aproximado/)).toBeInTheDocument();
  });

  it("destaca 'Tus intercambios' cuando el usuario participa", () => {
    render(<ResultsView results={results} currentUserId="u1" />, {
      wrapper: AllProviders,
    });
    expect(screen.getByText("Tus intercambios")).toBeInTheDocument();
  });

  it("muestra el tope de cadena elegido por el modo auto", () => {
    render(
      <ResultsView
        results={{
          ...results,
          summary: { ...results.summary, chosenChainLength: 3 },
        }}
      />,
      { wrapper: AllProviders },
    );
    expect(screen.getByText("tope de cadena elegido")).toBeInTheDocument();
  });

  it("permite alternar a la vista por usuario", () => {
    render(<ResultsView results={results} />, { wrapper: AllProviders });
    expect(screen.getByText(/Todas las cadenas/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Por usuario" }));
    // El detalle por cadena se reemplaza por el desglose por usuario.
    expect(screen.queryByText(/Todas las cadenas/)).not.toBeInTheDocument();
    expect(screen.getByText("ana")).toBeInTheDocument();
    expect(screen.getByText("beto")).toBeInTheDocument();
  });

  it("indica cuando no se concretó ningún intercambio", () => {
    render(
      <ResultsView
        results={{
          summary: { ...results.summary, itemsTraded: 0, cyclesCount: 0 },
          cycles: [],
        }}
      />,
      { wrapper: AllProviders },
    );
    expect(
      screen.getByText(/No se concretó ningún intercambio/),
    ).toBeInTheDocument();
  });
});
