import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

import MyGamesPicker from "./MyGamesPicker";

// 3 juegos ya en orden de recencia (el server ordena). Con limit=2 → 2 páginas.
const ALL = [
  {
    id: "13",
    name: "Catán",
    thumbnail: "https://cdn/catan.jpg",
    image: null,
    year: 1995,
    numPlays: 5,
    lastPlayedDate: "2026-05-01",
    owned: true,
  },
  {
    id: "42",
    name: "Azul",
    thumbnail: "https://cdn/azul.jpg",
    image: null,
    year: 2017,
    numPlays: 1,
    lastPlayedDate: "2026-03-01",
    owned: false,
  },
  {
    id: "99",
    name: "Wingspan",
    thumbnail: null,
    image: null,
    year: 2019,
    numPlays: 0,
    lastPlayedDate: null,
    owned: true,
  },
];

function misJuegosHandler({ request }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const page = Number(url.searchParams.get("page") || 1);
  const limit = 2;
  const filtered = q
    ? ALL.filter((g) => g.name.toLowerCase().includes(q))
    : ALL;
  const start = (page - 1) * limit;
  return HttpResponse.json({
    items: filtered.slice(start, start + limit),
    total: filtered.length,
    page,
    pages: Math.max(1, Math.ceil(filtered.length / limit)),
  });
}

beforeEach(() => {
  server.use(
    http.get("/api/bgg/mis-juegos/:user", misJuegosHandler),
    http.get("/api/bgg/search", () =>
      HttpResponse.json([
        { id: 14, name: "Carcassonne", thumbnail: null, year: 2000 },
      ]),
    ),
  );
});

describe("<MyGamesPicker>", () => {
  it("renderiza la primera página (no toda la lista)", async () => {
    render(<MyGamesPicker bggUsername="alice" onPick={vi.fn()} />);
    expect(await screen.findByText("Catán")).toBeInTheDocument();
    expect(screen.getByText("Azul")).toBeInTheDocument();
    // Wingspan está en la página 2 → no debería estar todavía.
    expect(screen.queryByText("Wingspan")).toBeNull();
    // Badge de partidas en el tile (Catán = 5×).
    expect(screen.getByText("5×")).toBeInTheDocument();
  });

  it("muestra el skeleton mientras carga y lo oculta al llegar los datos", async () => {
    render(<MyGamesPicker bggUsername="alice" onPick={vi.fn()} />);
    expect(screen.getByTestId("search-skeleton")).toBeInTheDocument();
    await screen.findByText("Catán");
    expect(screen.queryByTestId("search-skeleton")).toBeNull();
  });

  it("'Ver más' trae la página 2 y la appendea", async () => {
    render(<MyGamesPicker bggUsername="alice" onPick={vi.fn()} />);
    await screen.findByText("Catán");
    fireEvent.click(screen.getByRole("button", { name: /ver más/i }));
    expect(await screen.findByText("Wingspan")).toBeInTheDocument();
    // Las de la página 1 siguen presentes (append, no replace).
    expect(screen.getByText("Catán")).toBeInTheDocument();
    // Wingspan tiene 0 partidas → badge "nuevo".
    expect(screen.getByText("nuevo")).toBeInTheDocument();
  });

  it("la búsqueda refetchea server-side (debounced) con ?q", async () => {
    render(<MyGamesPicker bggUsername="alice" onPick={vi.fn()} />);
    await screen.findByText("Catán");
    fireEvent.change(screen.getByPlaceholderText(/filtrá tus juegos/i), {
      target: { value: "azul" },
    });
    await waitFor(() => {
      expect(screen.queryByText("Catán")).toBeNull();
    });
    expect(screen.getByText("Azul")).toBeInTheDocument();
  });

  it("no busca con menos de 3 caracteres; sí al llegar a 3", async () => {
    let calls = 0;
    let lastQ;
    server.use(
      http.get("/api/bgg/mis-juegos/:user", (ctx) => {
        calls += 1;
        lastQ = new URL(ctx.request.url).searchParams.get("q");
        return misJuegosHandler(ctx);
      }),
    );
    render(<MyGamesPicker bggUsername="alice" onPick={vi.fn()} />);
    await screen.findByText("Catán"); // carga inicial → 1 request
    fireEvent.change(screen.getByPlaceholderText(/filtrá tus juegos/i), {
      target: { value: "ca" },
    });
    await new Promise((r) => setTimeout(r, 400)); // pasa el debounce
    expect(calls).toBe(1); // 2 chars → NO refetchea
    expect(lastQ).toBeNull();
    fireEvent.change(screen.getByPlaceholderText(/filtrá tus juegos/i), {
      target: { value: "cat" },
    });
    await waitFor(() => expect(calls).toBe(2)); // 3 chars → busca
    expect(lastQ).toBe("cat");
  });

  it("llama onPick con la shape normalizada al clickear un juego", async () => {
    const onPick = vi.fn();
    render(<MyGamesPicker bggUsername="alice" onPick={onPick} />);
    const item = await screen.findByText("Catán");
    fireEvent.click(item.closest("button"));
    expect(onPick).toHaveBeenCalledWith({
      id: "13",
      name: "Catán",
      thumbnail: "https://cdn/catan.jpg",
      image: null,
      year: 1995,
    });
  });

  it("togglea a la búsqueda en BGG y forwardea el juego elegido", async () => {
    const onPick = vi.fn();
    render(<MyGamesPicker bggUsername="alice" onPick={onPick} />);
    await screen.findByText("Catán");
    fireEvent.click(screen.getByRole("button", { name: /buscar en bgg/i }));
    fireEvent.change(screen.getByPlaceholderText(/buscá un juego en bgg/i), {
      target: { value: "Carc" },
    });
    const result = await screen.findByText("Carcassonne");
    fireEvent.click(result.closest("button"));
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 14, name: "Carcassonne" }),
    );
  });

  it("muestra estado vacío cuando la lista está vacía", async () => {
    server.use(
      http.get("/api/bgg/mis-juegos/:user", () =>
        HttpResponse.json({ items: [], total: 0, page: 1, pages: 1 }),
      ),
    );
    render(<MyGamesPicker bggUsername="alice" onPick={vi.fn()} />);
    expect(await screen.findByText(/tu lista está vacía/i)).toBeInTheDocument();
  });

  it("sin bggUsername va directo a la búsqueda en BGG", async () => {
    render(<MyGamesPicker bggUsername="" onPick={vi.fn()} />);
    expect(
      await screen.findByPlaceholderText(/buscá un juego en bgg/i),
    ).toBeInTheDocument();
  });
});
