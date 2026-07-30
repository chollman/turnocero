import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";

import PhaseTransitionModal from "./PhaseTransitionModal";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function setupPreview(preview) {
  server.use(
    http.get("/api/torneos/:id/next-phase/preview", () =>
      HttpResponse.json(preview),
    ),
  );
}

function renderModal({ onClose = vi.fn(), onGenerated = vi.fn() } = {}) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <PhaseTransitionModal
          torneoId="t1"
          onClose={onClose}
          onGenerated={onGenerated}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("<PhaseTransitionModal>", () => {
  it("shows the heading once preview loads", async () => {
    setupPreview({
      advancersCount: 4,
      defaultTableSize: 4,
      valid: true,
      isFinal: true,
      finalTableSize: 4,
    });
    renderModal();
    expect(
      await screen.findByText(/generar siguiente fase/i),
    ).toBeInTheDocument();
  });

  it('renders the "mesa final" note when isFinal=true', async () => {
    setupPreview({
      advancersCount: 4,
      defaultTableSize: 4,
      valid: true,
      isFinal: true,
      finalTableSize: 4,
    });
    renderModal();
    expect(await screen.findByText(/mesa final/i)).toBeInTheDocument();
  });

  it('renders the "N mesas de M" note when valid but not final', async () => {
    setupPreview({
      advancersCount: 8,
      defaultTableSize: 4,
      valid: true,
      isFinal: false,
      finalTableSize: 4,
      tables: 2,
    });
    renderModal();
    expect(await screen.findByText(/2 mesas de 4/i)).toBeInTheDocument();
  });

  it("renders suggestion buttons when preview is invalid", async () => {
    setupPreview({
      advancersCount: 5,
      defaultTableSize: 4,
      valid: false,
      warnings: ["No se puede dividir 5 entre 4"],
      suggestions: [
        { label: "Una sola mesa de 5", overrideTableSize: 5 },
        { label: "1 mesa de 5", overrideTableSize: 5 },
      ],
    });
    renderModal();
    await screen.findByText(/No se puede dividir/i);
    expect(
      screen.getByRole("button", { name: "Una sola mesa de 5" }),
    ).toBeInTheDocument();
  });

  it("clicking a suggestion marks it active", async () => {
    setupPreview({
      advancersCount: 5,
      defaultTableSize: 4,
      valid: false,
      warnings: ["x"],
      suggestions: [{ label: "Una sola mesa de 5", overrideTableSize: 5 }],
    });
    renderModal();
    const btn = await screen.findByRole("button", {
      name: "Una sola mesa de 5",
    });
    fireEvent.click(btn);
    expect(btn.className).toMatch(/active/i);
  });

  it("clicking Generar (valid preview) POSTs to /next-phase and calls onGenerated", async () => {
    setupPreview({
      advancersCount: 8,
      defaultTableSize: 4,
      valid: true,
      isFinal: false,
      finalTableSize: 4,
      tables: 2,
    });
    const onGenerated = vi.fn();
    server.use(
      http.post("/api/torneos/:id/next-phase", () =>
        HttpResponse.json({ ok: true }),
      ),
    );
    renderModal({ onGenerated });
    const generarBtn = await screen.findByRole("button", { name: /generar/i });
    fireEvent.click(generarBtn);
    await waitFor(() => expect(onGenerated).toHaveBeenCalled());
  });

  it("Cancel calls onClose", async () => {
    setupPreview({
      advancersCount: 4,
      defaultTableSize: 4,
      valid: true,
      isFinal: true,
      finalTableSize: 4,
    });
    const onClose = vi.fn();
    renderModal({ onClose });
    await screen.findByText(/generar siguiente fase/i);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
