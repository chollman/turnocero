import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse, delay } from "msw";
import { server } from "../../test/server";
import { monthRange } from "./monthlyRecapMosaic";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

import MonthlyRecapModal from "./MonthlyRecapModal";

function renderModal(props = {}) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MonthlyRecapModal
        isOpen={props.isOpen ?? true}
        onClose={props.onClose || vi.fn()}
        bggUsername={props.bggUsername || "CarcaFan"}
      />
    </QueryClientProvider>,
  );
}

const gameFixture = {
  id: "13",
  name: "Catan",
  thumbnail: "thumb-13",
  image: "image-13",
  numPlays: 3,
};

describe("<MonthlyRecapModal>", () => {
  beforeEach(() => {
    server.use(
      http.get("/api/bgg/partidas-del-mes/:bggUsername", ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          range: {
            mindate: url.searchParams.get("mindate"),
            maxdate: url.searchParams.get("maxdate"),
          },
          stats: { totalPlays: 5, totalWins: 2, totalRated: 5, uniqueGames: 1 },
          games: [gameFixture],
        });
      }),
    );
  });

  it("renders nothing when closed", () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens with 'Este mes' selected and the generate button enabled", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /este mes/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generar mosaico/i }),
    ).not.toBeDisabled();
  });

  it("switching to 'Personalizado' shows two date pickers and disables generate until both are set", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /^personalizado$/i }));
    expect(screen.getByText(/desde/i)).toBeInTheDocument();
    expect(screen.getByText(/hasta/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generar mosaico/i })).toBeDisabled();
  });

  it("does not fetch until 'Generar' is clicked", async () => {
    let called = false;
    server.use(
      http.get("/api/bgg/partidas-del-mes/:bggUsername", () => {
        called = true;
        return HttpResponse.json({
          range: {},
          stats: { totalPlays: 0, totalWins: 0, totalRated: 0, uniqueGames: 0 },
          games: [],
        });
      }),
    );
    renderModal();
    await new Promise((r) => {
      setTimeout(r, 30);
    });
    expect(called).toBe(false);
  });

  it("clicking 'Generar' fetches the current month range and renders the mosaic + download button", async () => {
    const expectedRange = monthRange();
    let requestedParams = null;
    server.use(
      http.get("/api/bgg/partidas-del-mes/:bggUsername", ({ request }) => {
        const url = new URL(request.url);
        requestedParams = {
          mindate: url.searchParams.get("mindate"),
          maxdate: url.searchParams.get("maxdate"),
        };
        return HttpResponse.json({
          range: requestedParams,
          stats: { totalPlays: 5, totalWins: 2, totalRated: 5, uniqueGames: 1 },
          games: [gameFixture],
        });
      }),
    );

    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /generar mosaico/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /descargar imagen/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole("img", { name: /vista previa del mosaico/i })).toBeInTheDocument();
    expect(requestedParams).toEqual(expectedRange);
  });

  it("shows an empty state (no canvas/download) when the period has no plays", async () => {
    server.use(
      http.get("/api/bgg/partidas-del-mes/:bggUsername", () =>
        HttpResponse.json({
          range: { mindate: "2026-08-01", maxdate: "2026-08-31" },
          stats: { totalPlays: 0, totalWins: 0, totalRated: 0, uniqueGames: 0 },
          games: [],
        }),
      ),
    );
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /generar mosaico/i }));

    await waitFor(() =>
      expect(screen.getByText(/sin partidas en este período/i)).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /descargar imagen/i }),
    ).not.toBeInTheDocument();
  });

  it("shows an inline error when the request fails", async () => {
    server.use(
      http.get("/api/bgg/partidas-del-mes/:bggUsername", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /generar mosaico/i }));

    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
  });

  it("changing the range chip after generating hides the previous preview until re-generated", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /generar mosaico/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /descargar imagen/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /mes anterior/i }));
    expect(
      screen.queryByRole("button", { name: /descargar imagen/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generar mosaico/i })).toBeInTheDocument();
  });

  it("keeps the loading label while the request is in flight", async () => {
    server.use(
      http.get("/api/bgg/partidas-del-mes/:bggUsername", async () => {
        await delay(50);
        return HttpResponse.json({
          range: {},
          stats: { totalPlays: 0, totalWins: 0, totalRated: 0, uniqueGames: 0 },
          games: [],
        });
      }),
    );
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /generar mosaico/i }));
    expect(await screen.findByRole("button", { name: /generando…/i })).toBeDisabled();
  });

  it("resets to 'Este mes' after closing and reopening", () => {
    const { rerender } = render(
      <QueryClientProvider client={makeQueryClient()}>
        <MonthlyRecapModal isOpen bggUsername="CarcaFan" onClose={vi.fn()} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^personalizado$/i }));
    expect(screen.getByText(/desde/i)).toBeInTheDocument();

    rerender(
      <QueryClientProvider client={makeQueryClient()}>
        <MonthlyRecapModal isOpen={false} bggUsername="CarcaFan" onClose={vi.fn()} />
      </QueryClientProvider>,
    );
    rerender(
      <QueryClientProvider client={makeQueryClient()}>
        <MonthlyRecapModal isOpen bggUsername="CarcaFan" onClose={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(screen.queryByText(/desde/i)).not.toBeInTheDocument();
  });
});
