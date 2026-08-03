import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

vi.mock("../../components/shared/Avatar", () => ({
  default: ({ user }) => <div data-testid="avatar">{user?.username || ""}</div>,
}));

import PlayerPicker from "./PlayerPicker";

const CO_PLAYERS = [
  {
    name: "Bob",
    username: "bobbgg",
    numPlays: 5,
    lastPlayedDate: "2026-05-01",
  },
  {
    name: "Tía Susana",
    username: "",
    numPlays: 2,
    lastPlayedDate: "2026-03-01",
  },
];

const TC_USERS = [
  {
    _id: "u1",
    username: "carla",
    displayName: "Carla",
    bggUsername: "carlabgg",
    isFriend: true,
  },
  {
    _id: "u2",
    username: "diego",
    displayName: "Diego",
    bggUsername: "",
    isFriend: false,
  },
];

beforeEach(() => {
  server.use(
    http.get("/api/bgg/mis-jugadores/:user", ({ request }) => {
      const q = (
        new URL(request.url).searchParams.get("q") || ""
      ).toLowerCase();
      const items = q
        ? CO_PLAYERS.filter((p) => p.name.toLowerCase().includes(q))
        : CO_PLAYERS;
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        pages: 1,
      });
    }),
    http.get("/api/users/jugadores", () =>
      HttpResponse.json({
        items: TC_USERS,
        total: TC_USERS.length,
        page: 1,
        pages: 1,
      }),
    ),
    http.post("/api/users/by-bgg-usernames", async ({ request }) => {
      const { usernames } = await request.json();
      const set = new Set((usernames || []).map((u) => u.toLowerCase()));
      // Bob (bobbgg) es miembro de TurnoCero con avatar; el resto no.
      const all = [
        {
          _id: "tc-bob",
          username: "bobtc",
          displayName: "Bob",
          bggUsername: "bobbgg",
          avatar: { url: "https://x/bob.webp", publicId: "bob" },
        },
      ];
      return HttpResponse.json(
        all.filter((u) => set.has(u.bggUsername.toLowerCase())),
      );
    }),
  );
});

describe("<PlayerPicker>", () => {
  it("muestra los compañeros de BGG por defecto", async () => {
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <PlayerPicker
        bggUsername="me"
        existing={[]}
        onPick={vi.fn()}
        onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Tía Susana")).toBeInTheDocument();
    expect(screen.getByText(/5 partidas/i)).toBeInTheDocument();
  });

  it("muestra el avatar del compañero que es miembro de TurnoCero (por BGG)", async () => {
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <PlayerPicker
        bggUsername="me"
        existing={[]}
        onPick={vi.fn()}
        onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    // Bob (bobbgg) está vinculado a un usuario de TurnoCero → su avatar resuelve
    // al miembro (bobtc) cuando llega el userMap.
    await waitFor(() =>
      expect(
        screen.getAllByTestId("avatar").some((a) => a.textContent === "bobtc"),
      ).toBe(true),
    );
    // Tía Susana (sin BGG) ahora también usa <Avatar> (iniciales), no 👤.
    expect(screen.getAllByTestId("avatar")).toHaveLength(2);
    expect(screen.queryByText("👤")).toBeNull();
  });

  it("muestra el avatar curado (overlay) del compañero aunque no sea miembro", async () => {
    server.use(
      http.get("/api/bgg/mis-jugadores/:user", () =>
        HttpResponse.json({
          items: [
            {
              key: "o:1",
              name: "Tía Susana",
              username: "",
              numPlays: 3,
              avatar: { url: "https://x/susana.webp", publicId: "susana" },
            },
          ],
          total: 1,
          page: 1,
          pages: 1,
        }),
      ),
    );
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <PlayerPicker
        bggUsername="me"
        existing={[]}
        onPick={vi.fn()}
        onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    await screen.findByText("Tía Susana");
    // El avatar del overlay se renderiza aunque no haya match en TurnoCero.
    expect(screen.getByTestId("avatar")).toBeInTheDocument();
  });

  it("muestra el loader (dado) mientras carga y lo oculta al llegar los datos", async () => {
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <PlayerPicker
        bggUsername="me"
        existing={[]}
        onPick={vi.fn()}
        onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/buscando jugadores/i);
    await screen.findByText("Bob");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("no busca con menos de 3 caracteres; sí al llegar a 3", async () => {
    let calls = 0;
    let lastQ;
    server.use(
      http.get("/api/bgg/mis-jugadores/:user", ({ request }) => {
        calls += 1;
        lastQ = new URL(request.url).searchParams.get("q");
        return HttpResponse.json({
          items: CO_PLAYERS,
          total: CO_PLAYERS.length,
          page: 1,
          pages: 1,
        });
      }),
    );
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <PlayerPicker
        bggUsername="me"
        existing={[]}
        onPick={vi.fn()}
        onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    await screen.findByText("Bob"); // carga inicial → 1 request
    fireEvent.change(
      screen.getByPlaceholderText(/buscá o escribí un jugador/i),
      {
        target: { value: "bo" },
      },
    );
    await new Promise((r) => {
      setTimeout(r, 400);
    });
    expect(calls).toBe(1); // 2 chars → NO refetchea
    expect(lastQ).toBeNull();
    fireEvent.change(
      screen.getByPlaceholderText(/buscá o escribí un jugador/i),
      {
        target: { value: "bob" },
      },
    );
    await waitFor(() => expect(calls).toBe(2)); // 3 chars → busca
    expect(lastQ).toBe("bob");
  });

  it("elegir un compañero llama onPick con name + username", async () => {
    const onPick = vi.fn();
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <PlayerPicker
        bggUsername="me"
        existing={[]}
        onPick={onPick}
        onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    expect(onPick).toHaveBeenCalledWith({ name: "Bob", username: "bobbgg" });
  });

  it("al elegir un jugador limpia el input y lo reenfoca para buscar otro", async () => {
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <PlayerPicker
        bggUsername="me"
        existing={[]}
        onPick={vi.fn()}
        onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    await screen.findByText("Bob");
    const input = screen.getByPlaceholderText(/buscá o escribí un jugador/i);
    fireEvent.change(input, { target: { value: "Bob" } });
    expect(input).toHaveValue("Bob");
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    // El picker no se cierra: el input queda vacío y enfocado para el siguiente.
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("ofrece 'Usar «…»' para un nombre nuevo no listado", async () => {
    const onPick = vi.fn();
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <PlayerPicker
        bggUsername="me"
        existing={[]}
        onPick={onPick}
        onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    await screen.findByText("Bob");
    fireEvent.change(
      screen.getByPlaceholderText(/buscá o escribí un jugador/i),
      {
        target: { value: "Pedro" },
      },
    );
    const createBtn = await screen.findByRole("button", {
      name: /usar «pedro»/i,
    });
    fireEvent.click(createBtn);
    expect(onPick).toHaveBeenCalledWith({ name: "Pedro", username: "" });
  });

  it("sin compañeros (lista vacía, sin búsqueda) tampoco muestra empty state", async () => {
    server.use(
      http.get("/api/bgg/mis-jugadores/:user", () =>
        HttpResponse.json({ items: [], total: 0, page: 1, pages: 1 }),
      ),
    );
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <PlayerPicker
        bggUsername="me"
        existing={[]}
        onPick={vi.fn()}
        onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    // Esperar a que termine la carga (desaparece el loader).
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.queryByText(/sin compañeros/i)).toBeNull();
    // Queda el camino de salida: buscar un usuario de TurnoCero.
    expect(
      screen.getByRole("button", { name: /buscar un usuario de turnocero/i }),
    ).toBeInTheDocument();
  });

  it("buscando sin coincidencias NO muestra el empty state (queda 'Usar «…»')", async () => {
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <PlayerPicker
        bggUsername="me"
        existing={[]}
        onPick={vi.fn()}
        onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    await screen.findByText("Bob");
    fireEvent.change(
      screen.getByPlaceholderText(/buscá o escribí un jugador/i),
      { target: { value: "Zacarías" } },
    );
    await screen.findByRole("button", { name: /usar «zacarías»/i });
    expect(screen.queryByText(/sin coincidencias/i)).toBeNull();
    expect(screen.queryByText(/ningún compañero coincide/i)).toBeNull();
  });

  it("excluye compañeros ya agregados", async () => {
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <PlayerPicker
        bggUsername="me"
        existing={[{ name: "Bob", username: "bobbgg" }]}
        onPick={vi.fn()}
        onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Tía Susana")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).toBeNull();
  });

  it("togglea al modo TurnoCero y vincula por bggUsername", async () => {
    const onPick = vi.fn();
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <PlayerPicker
        bggUsername="me"
        existing={[]}
        onPick={onPick}
        onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    await screen.findByText("Bob");
    fireEvent.click(
      screen.getByRole("button", { name: /buscar un usuario de turnocero/i }),
    );
    // Carla (amiga, con BGG) → onPick usa su bggUsername.
    fireEvent.click((await screen.findByText("Carla")).closest("button"));
    expect(onPick).toHaveBeenCalledWith({
      name: "Carla",
      username: "carlabgg",
    });
  });

  it("un usuario de TurnoCero sin BGG se agrega solo por nombre", async () => {
    const onPick = vi.fn();
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <PlayerPicker
        bggUsername="me"
        existing={[]}
        onPick={onPick}
        onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    await screen.findByText("Bob");
    fireEvent.click(
      screen.getByRole("button", { name: /buscar un usuario de turnocero/i }),
    );
    const diego = await screen.findByText("Diego");
    expect(screen.getByText(/sin bgg/i)).toBeInTheDocument();
    fireEvent.click(diego.closest("button"));
    expect(onPick).toHaveBeenCalledWith({ name: "Diego", username: "" });
  });

  it("cancela con la ✕", async () => {
    const onCancel = vi.fn();
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <PlayerPicker
        bggUsername="me"
        existing={[]}
        onPick={vi.fn()}
        onCancel={onCancel}
        />
      </QueryClientProvider>,
    );
    await screen.findByText("Bob");
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
