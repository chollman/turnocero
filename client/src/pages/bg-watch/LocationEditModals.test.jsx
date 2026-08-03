import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

import { EditLocationModal } from "./LocationEditModals";

function casa(extra = {}) {
  return {
    key: "k:l:casa",
    overlayId: null,
    rawKeys: ["l:casa"],
    name: "Casa",
    numPlays: 5,
    lastPlayedDate: "2026-03-01",
    ...extra,
  };
}

function listResponse(items) {
  return HttpResponse.json({
    items,
    total: items.length,
    page: 1,
    pages: 1,
  });
}

beforeEach(() => {
  server.use(
    http.get("/api/bgg/ubicaciones/:user", () => listResponse([casa()])),
  );
});

describe("<EditLocationModal>", () => {
  it("guardar el nombre pega al endpoint correcto", async () => {
    let body = null;
    server.use(
      http.patch("/api/bgg/ubicaciones/:user/nombre", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ location: casa({ name: "Mi Casa" }) });
      }),
    );
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <EditLocationModal
        bggUsername="alice"
        location={casa()}
        onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );

    const input = screen.getByDisplayValue("Casa");
    fireEvent.change(input, { target: { value: "Mi Casa" } });
    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(body).toBeTruthy());
    expect(body).toEqual({ rawKeys: ["l:casa"], name: "Mi Casa" });
    expect(await screen.findByText(/nombre guardado/i)).toBeInTheDocument();
  });

  it("no permite guardar un nombre vacío", async () => {
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <EditLocationModal
        bggUsername="alice"
        location={casa()}
        onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByDisplayValue("Casa"), {
      target: { value: "  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));
    expect(
      await screen.findByText(/no puede estar vacío/i),
    ).toBeInTheDocument();
  });

  it("cerrar sin cambios devuelve false", () => {
    const onClose = vi.fn();
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <EditLocationModal
        bggUsername="alice"
        location={casa()}
        onClose={onClose}
        />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText("Cerrar"));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("cerrar después de renombrar devuelve 'updated'", async () => {
    const onClose = vi.fn();
    server.use(
      http.patch("/api/bgg/ubicaciones/:user/nombre", () =>
        HttpResponse.json({ location: casa({ name: "Mi Casa" }) }),
      ),
    );
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <EditLocationModal
        bggUsername="alice"
        location={casa()}
        onClose={onClose}
        />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByDisplayValue("Casa"), {
      target: { value: "Mi Casa" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));
    await screen.findByText(/nombre guardado/i);
    fireEvent.click(screen.getByText("Cerrar"));
    expect(onClose).toHaveBeenCalledWith("updated");
  });

  it("'Fusionar' abre el modal de fusión y confirma → onClose('merged')", async () => {
    let mergeBody = null;
    const onClose = vi.fn();
    server.use(
      http.get("/api/bgg/ubicaciones/:user", () =>
        listResponse([
          casa(),
          casa({
            key: "k:l:club",
            rawKeys: ["l:club"],
            name: "Club",
            numPlays: 2,
          }),
        ]),
      ),
      http.post("/api/bgg/ubicaciones/:user/merge", async ({ request }) => {
        mergeBody = await request.json();
        return HttpResponse.json({ location: casa() });
      }),
    );
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <EditLocationModal
        bggUsername="alice"
        location={casa()}
        onClose={onClose}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /fusionar con otra ubicación/i }),
    );

    const dialog = await screen.findByRole("dialog");
    const club = await within(dialog).findByText("Club");
    fireEvent.click(club.closest("button"));

    const confirmTitle = await screen.findByText("Fusionar ubicaciones");
    fireEvent.click(
      within(confirmTitle.closest("div")).getByRole("button", {
        name: /^fusionar$/i,
      }),
    );

    await waitFor(() => expect(mergeBody).toBeTruthy());
    expect(mergeBody).toEqual({
      sourceRawKeys: ["l:casa"],
      targetRawKeys: ["l:club"],
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("merged"));
  });
});
