import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

import LocationPicker from "./LocationPicker";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

// 3 ubicaciones ya en orden de recencia (el server ordena). Con limit=2 → 2 págs.
const ALL = [
  { name: "Casa", numPlays: 5, lastPlayedDate: "2026-05-01" },
  { name: "Club", numPlays: 2, lastPlayedDate: "2026-03-01" },
  { name: "Café Müller", numPlays: 1, lastPlayedDate: "2026-01-10" },
];

function norm(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function misUbicacionesHandler({ request }) {
  const url = new URL(request.url);
  const q = norm(url.searchParams.get("q") || "");
  const page = Number(url.searchParams.get("page") || 1);
  const limit = 2;
  const filtered = q ? ALL.filter((l) => norm(l.name).includes(q)) : ALL;
  const start = (page - 1) * limit;
  return HttpResponse.json({
    items: filtered.slice(start, start + limit),
    total: filtered.length,
    page,
    pages: Math.max(1, Math.ceil(filtered.length / limit)),
  });
}

const PLACEHOLDER = /elegí o escribí una ubicación/i;

beforeEach(() => {
  server.use(http.get("/api/bgg/mis-ubicaciones/:user", misUbicacionesHandler));
});

function renderLP(props = {}) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <LocationPicker
        bggUsername="alice"
        value={props.value || ""}
        onPick={props.onPick || vi.fn()}
        onClose={props.onClose || vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("<LocationPicker>", () => {
  it("lista las ubicaciones ya usadas al montar (sin necesidad de abrir nada)", async () => {
    renderLP();
    expect(await screen.findByText("Casa")).toBeInTheDocument();
  });

  it("muestra el loader (dado) mientras carga y lo oculta al llegar los datos", async () => {
    renderLP();
    expect(screen.getByRole("status")).toHaveTextContent(/buscando ubicaciones/i);
    await screen.findByText("Casa");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("al montar muestra la primera página (no toda la lista)", async () => {
    renderLP();
    expect(await screen.findByText("Casa")).toBeInTheDocument();
    expect(screen.getByText("Club")).toBeInTheDocument();
    // Café Müller está en la página 2 → no debería estar todavía.
    expect(screen.queryByText("Café Müller")).toBeNull();
    expect(screen.getByText(/5 partidas/i)).toBeInTheDocument();
  });

  it("'Ver más' trae la página 2 y la appendea", async () => {
    renderLP();
    await screen.findByText("Casa");
    fireEvent.click(screen.getByRole("button", { name: /ver más/i }));
    expect(await screen.findByText("Café Müller")).toBeInTheDocument();
    expect(screen.getByText("Casa")).toBeInTheDocument();
  });

  it("la búsqueda refetchea server-side (debounced) con ?q", async () => {
    renderLP();
    await screen.findByText("Casa");
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: "club" },
    });
    await waitFor(() => {
      expect(screen.queryByText("Casa")).toBeNull();
      expect(screen.getByText("Club")).toBeInTheDocument();
    });
  });

  it("no busca con menos de 3 caracteres; sí al llegar a 3", async () => {
    let calls = 0;
    let lastQ;
    server.use(
      http.get("/api/bgg/mis-ubicaciones/:user", (ctx) => {
        calls += 1;
        lastQ = new URL(ctx.request.url).searchParams.get("q");
        return misUbicacionesHandler(ctx);
      }),
    );
    renderLP();
    await screen.findByText("Casa"); // carga inicial → 1 request
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: "ca" },
    });
    await new Promise((r) => {
      setTimeout(r, 400);
    });
    expect(calls).toBe(1); // 2 chars → NO refetchea
    expect(lastQ).toBeNull();
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: "caf" },
    });
    await waitFor(() => expect(calls).toBe(2)); // 3 chars → busca
    expect(lastQ).toBe("caf");
  });

  it("elegir una ubicación existente llama onPick + onClose", async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    renderLP({ onPick, onClose });
    const item = await screen.findByText("Casa");
    fireEvent.click(item.closest("button"));
    expect(onPick).toHaveBeenCalledWith("Casa");
    expect(onClose).toHaveBeenCalled();
  });

  it("ofrece 'Usar «…»' y crea una ubicación nueva no listada", async () => {
    const onPick = vi.fn();
    renderLP({ onPick });
    await screen.findByText("Casa");
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: "Mi nueva ubi" },
    });
    const createBtn = await screen.findByRole("button", {
      name: /usar «mi nueva ubi»/i,
    });
    fireEvent.click(createBtn);
    expect(onPick).toHaveBeenCalledWith("Mi nueva ubi");
  });

  it("Enter con texto elige el escrito", async () => {
    const onPick = vi.fn();
    renderLP({ onPick });
    await screen.findByText("Casa");
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(input, { target: { value: "Bar nuevo" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith("Bar nuevo");
  });

  it("NO ofrece 'Usar «…»' si el término coincide con una existente", async () => {
    renderLP();
    await screen.findByText("Casa");
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: "casa" },
    });
    await waitFor(() => {
      expect(screen.getByText("Casa")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /usar «/i })).toBeNull();
  });

  it("resalta la ubicación actualmente elegida en la lista", async () => {
    renderLP({ value: "Casa" });
    const item = await screen.findByText("Casa");
    expect(item.closest("button")).toHaveClass("locationItemActive");
  });

  it("cierra con la ✕", async () => {
    const onClose = vi.fn();
    renderLP({ onClose });
    await screen.findByText("Casa");
    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("sin bggUsername cae a un input de texto libre", () => {
    const onPick = vi.fn();
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <LocationPicker
          bggUsername=""
          value=""
          onPick={onPick}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );
    const input = screen.getByLabelText("Ubicación");
    fireEvent.change(input, { target: { value: "Casa de Juan" } });
    expect(onPick).toHaveBeenCalledWith("Casa de Juan");
  });

  it("hace foco automático en el input al montar en desktop", async () => {
    renderLP();
    await screen.findByText("Casa");
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveFocus();
  });

  it("NO hace foco automático en el input al montar en touch devices (no dispara el teclado virtual)", async () => {
    const matchMediaSpy = vi
      .spyOn(window, "matchMedia")
      .mockImplementation((query) => ({
        matches: query === "(pointer: coarse)",
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }));
    renderLP();
    await screen.findByText("Casa");
    expect(screen.getByPlaceholderText(PLACEHOLDER)).not.toHaveFocus();
    matchMediaSpy.mockRestore();
  });

  it("estado vacío cuando no hay ubicaciones", async () => {
    server.use(
      http.get("/api/bgg/mis-ubicaciones/:user", () =>
        HttpResponse.json({ items: [], total: 0, page: 1, pages: 0 }),
      ),
    );
    renderLP();
    expect(await screen.findByText(/sin ubicaciones aún/i)).toBeInTheDocument();
  });
});
