import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../components/shared/Avatar", () => ({
  default: ({ user }) => <div data-testid="avatar">{user?.username || ""}</div>,
}));

import PlayForm from "./PlayForm";

function makeUser(overrides = {}) {
  return {
    _id: "me",
    username: "me",
    displayName: "Me",
    bggUsername: "meBGG",
    bggConnected: true,
    ...overrides,
  };
}

function renderForm(props = {}) {
  return render(
    <MemoryRouter>
      <PlayForm
        user={props.user || makeUser()}
        initialValues={props.initialValues}
        editMode={props.editMode}
        lockedGame={props.lockedGame}
        submitting={props.submitting}
        serverError={props.serverError}
        onSubmit={props.onSubmit || vi.fn()}
        onCancel={props.onCancel || vi.fn()}
        onDelete={props.onDelete}
        keepGoing={props.keepGoing}
        onKeepGoingChange={props.onKeepGoingChange}
        lastJuntada={props.lastJuntada}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  server.use(
    http.get("/api/bgg/mis-juegos/:user", () =>
      HttpResponse.json({
        items: [
          { id: "13", name: "Catán", thumbnail: null, year: 1995, numPlays: 5 },
        ],
        total: 1,
        page: 1,
        pages: 1,
      }),
    ),
    http.get("/api/bgg/mis-ubicaciones/:user", () =>
      HttpResponse.json({ items: [], total: 0, page: 1, pages: 0 }),
    ),
    http.get("/api/bgg/mis-jugadores/:user", () =>
      HttpResponse.json({
        items: [
          {
            name: "Bob",
            username: "bob",
            numPlays: 2,
            lastPlayedDate: "2026-01-01",
          },
        ],
        total: 1,
        page: 1,
        pages: 1,
      }),
    ),
    http.get("/api/users/jugadores", () =>
      HttpResponse.json({ items: [], total: 0, page: 1, pages: 0 }),
    ),
    http.get("/api/bgg/jugado/:user/:gameId", () =>
      HttpResponse.json({ played: true, numPlays: 3 }),
    ),
  );
});

describe("<PlayForm>", () => {
  it("renderiza las tres secciones", () => {
    renderForm();
    // "El juego" es el título de sección; "Jugadores"/"Extras" aparecen también
    // en el stepper, por eso van con getAllByText.
    expect(screen.getByText("El juego")).toBeInTheDocument();
    expect(screen.getAllByText("Jugadores").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Extras").length).toBeGreaterThan(0);
  });

  it("con lockedGame muestra el juego sin el selector", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    expect(screen.getAllByText("Catán").length).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText(/filtrá tus juegos/i)).toBeNull();
  });

  it("prefilla el jugador 1 con el usuario", () => {
    renderForm({ initialValues: { game: { id: "13", name: "Catán" } } });
    expect(screen.getByDisplayValue("Me")).toBeInTheDocument();
    expect(screen.getByDisplayValue("meBGG")).toBeInTheDocument();
  });

  it("submit arma el payload esperado", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      onSubmit,
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar en bgg/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.objectid).toBe("13");
    expect(payload.players[0]).toMatchObject({ name: "Me", position: 1 });
  });

  it("muestra el check 'Cargar otra' sólo si onKeepGoingChange está presente", () => {
    const { unmount } = renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
    });
    // Sin onKeepGoingChange → no aparece.
    expect(screen.queryByText(/cargar otra partida después/i)).toBeNull();
    unmount();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      onKeepGoingChange: vi.fn(),
    });
    expect(
      screen.getByText(/cargar otra partida después/i),
    ).toBeInTheDocument();
  });

  it("togglear 'Cargar otra' llama onKeepGoingChange y cambia el CTA", () => {
    const onKeepGoingChange = vi.fn();
    const { rerender } = renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      keepGoing: false,
      onKeepGoingChange,
    });
    expect(
      screen.getByRole("button", { name: /guardar en bgg/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /cargar otra/i }));
    expect(onKeepGoingChange).toHaveBeenCalledWith(true);
    // Con keepGoing=true el CTA cambia.
    rerender(
      <MemoryRouter>
        <PlayForm
          user={makeUser()}
          initialValues={{ game: { id: "13", name: "Catán" } }}
          lockedGame
          keepGoing
          onKeepGoingChange={onKeepGoingChange}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: /guardar y cargar otra/i }),
    ).toBeInTheDocument();
  });

  it("autodetecta 'Nuevo' para el dueño si nunca jugó el juego", async () => {
    server.use(
      http.get("/api/bgg/jugado/:user/:gameId", () =>
        HttpResponse.json({ played: false, numPlays: 0 }),
      ),
    );
    renderForm({ initialValues: { game: { id: "13", name: "Catán" } } });
    expect(await screen.findByText(/nuevo/i)).toBeInTheDocument();
  });

  it("agregar jugador abre el picker y suma una fila", async () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    expect(screen.getAllByPlaceholderText("Nombre")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    expect(screen.getAllByPlaceholderText("Nombre")).toHaveLength(2);
    expect(screen.getByDisplayValue("Bob")).toBeInTheDocument();
  });

  it("en modo edición muestra título y CTA de edición + danger zone", () => {
    const onDelete = vi.fn();
    renderForm({
      editMode: true,
      lockedGame: true,
      initialValues: {
        game: { id: "13", name: "Catán" },
        players: [{ name: "X", username: "", win: false, new: false }],
      },
      onDelete,
    });
    expect(screen.getByText("Editar partida")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /guardar cambios/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /eliminar partida/i }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("muestra el serverError", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      serverError: "Algo falló",
    });
    expect(screen.getByText("Algo falló")).toBeInTheDocument();
  });

  it("deriva la posición del puntaje (mayor score = 1°)", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      onSubmit,
    });
    // Agregar a Bob como 2º jugador.
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    const scores = screen.getAllByPlaceholderText("Score");
    fireEvent.change(scores[0], { target: { value: "5" } }); // Me (fila 0)
    fireEvent.change(scores[1], { target: { value: "10" } }); // Bob (fila 1)
    fireEvent.click(screen.getByRole("button", { name: /guardar en bgg/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const { players } = onSubmit.mock.calls[0][0];
    expect(players.find((p) => p.name === "Bob").position).toBe(1);
    expect(players.find((p) => p.name === "Me").position).toBe(2);
  });

  it("los atajos +/- cambian el puntaje", () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    const score = screen.getByPlaceholderText("Score");
    expect(score.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /subir puntaje/i }));
    expect(score.value).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: /subir puntaje/i }));
    expect(score.value).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: /bajar puntaje/i }));
    expect(score.value).toBe("1");
  });

  it("'Ordenar por puntaje' aparece con scores y reordena por score desc", async () => {
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /agregar jugador/i }));
    fireEvent.click((await screen.findByText("Bob")).closest("button"));
    // Sin scores el botón no se muestra.
    expect(
      screen.queryByRole("button", { name: /ordenar por puntaje/i }),
    ).toBeNull();
    const scores = screen.getAllByPlaceholderText("Score");
    fireEvent.change(scores[0], { target: { value: "5" } }); // Me
    fireEvent.change(scores[1], { target: { value: "10" } }); // Bob
    fireEvent.click(
      screen.getByRole("button", { name: /ordenar por puntaje/i }),
    );
    // Bob (10) pasa a la primera fila.
    const names = screen.getAllByPlaceholderText("Nombre");
    expect(names[0].value).toBe("Bob");
    expect(names[1].value).toBe("Me");
  });

  it("una fecha futura muestra error y deshabilita el submit", () => {
    const { container } = renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    const submit = screen.getByRole("button", { name: /guardar en bgg/i });
    expect(submit).not.toBeDisabled();
    const dateInput = container.querySelector('input[type="date"]');
    fireEvent.change(dateInput, { target: { value: "2099-12-31" } });
    expect(screen.getByText(/no puede ser futura/i)).toBeInTheDocument();
    expect(submit).toBeDisabled();
  });

  it("'Usar última juntada' precarga jugadores + ubicación", async () => {
    const onSubmit = vi.fn();
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
      onSubmit,
      lastJuntada: {
        location: "Club de Mesa",
        players: [
          { name: "Ana", username: "anabgg" },
          { name: "Beto", username: "" },
        ],
      },
    });
    // Arranca solo con el dueño "Me".
    expect(screen.getAllByPlaceholderText("Nombre")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /usar última juntada/i }));
    expect(
      screen.getAllByPlaceholderText("Nombre").map((n) => n.value),
    ).toEqual(["Ana", "Beto"]);
    // La ubicación viajó al payload.
    fireEvent.click(screen.getByRole("button", { name: /guardar en bgg/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.location).toBe("Club de Mesa");
    expect(payload.players.map((p) => p.name)).toEqual(["Ana", "Beto"]);
  });

  it("no muestra 'Usar última juntada' en modo edición", () => {
    renderForm({
      editMode: true,
      lockedGame: true,
      initialValues: {
        game: { id: "13", name: "Catán" },
        players: [{ name: "X", username: "" }],
      },
      lastJuntada: { location: "Club", players: [{ name: "Ana", username: "anabgg" }] },
    });
    expect(
      screen.queryByRole("button", { name: /usar última juntada/i }),
    ).toBeNull();
  });

  it("el preview resuelve avatares de jugadores miembros (useBggUserMap)", async () => {
    server.use(
      http.post("/api/users/by-bgg-usernames", () =>
        HttpResponse.json([
          {
            _id: "u9",
            username: "meuser",
            displayName: "Me User",
            avatar: { url: "", publicId: "" },
            bggUsername: "meBGG",
          },
        ]),
      ),
    );
    renderForm({
      initialValues: { game: { id: "13", name: "Catán" } },
      lockedGame: true,
    });
    // El jugador 1 ("Me", @meBGG) se resuelve a su user de TurnoCero en el
    // preview → el Avatar (mockeado) muestra su username.
    expect(await screen.findByTestId("avatar")).toHaveTextContent("meuser");
  });
});
